import * as hre from "hardhat";
import { SafeKit } from "./safeKit";
import { Domain, SafeKitConfig } from "./types";
import { connectToDb, proposeRegistrations } from "./helpers";
import { ROOT_COLL_NAME, ROOT_DOMAIN_BULK_SELECTOR, SUB_COLL_NAME, SUBDOMAIN_BULK_SELECTOR } from "./constants";
import { getZNS } from "./zns-contract-data";
import { ZeroAddress } from "ethers";
import { TLogger } from "@zero-tech/zdc";
import { getZnsLogger } from "../../deploy/get-logger";

/**
 * Script to create and propose signed transactions to the Safe for
 * as part of the second half of the ZNS domain migration.
 *
 * This script will get the latest ZNS contracts as well as the domain information
 * from MongoDB. Then that data is formed into batches of raw txData encoding to
 * propose to the safe.
 *
 * Required .env variables for running this script:
 * - MONGO_DB_URI
 * - MONGO_DB_NAME
 * - MONGO_DB_VERSION
 * - MONGO_DB_URI_MIG (The domain data is in a different cluster that needs a different connection)
 * - MONGO_DB_NAME_MIG
 * - SAFE_ADDRESS
 * - SAFE_OWNER (for HardHat config)
 * - CHAIN_ID
 * - [NETWORK]_RPC_URL (substitute NETWORK for the specific network being used)
 *
 * Optional .env vars
 * - DELAY
 * - RETRIES
 *
 * Required steps:
 * - ZNS v1.5 contracts must have been deployed to the target network
 * - ERC20 contract must have been deployed to the target network
 * - The Safe must already exist
 * - The Safe must have given approval for the ZNSTreasury to spend
 * - The Safe must have the need ERC20 balance to register
 * - The Safe must have enough native token to fund the gas needed for each batch
 *
 * Execution: After manually setting the `action` desired, run
 * `yarn hardhat run src/utils/migration/register-main.ts --network [NETWORK]
 *
 * Note: Parent domains must exist for child domains to be minted. This will fail in
 * gas estimation by the SafeKit if the parent domain does not exist already, so we
 * must propose *and* execute all root domains before we can propose any subdomains
 *
 * Note: Manual gas estimation is done in the SafeKit as the documentation specifies
 * that while estimation is done automatically if excluded, it may not be accurate for
 * more complex transactions. To avoid the possibility of this failing downstream, this
 * is done here.
 *
 * Note: Executing more than ~20 transactions sequentially isn't recommended.
 * This may cause the provider to ignore transactions, incorrectly showing
 * they executed successfully.
 */
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const logger : TLogger = getZnsLogger();

  // Get domain data from different db
  const client = await connectToDb();

  const safeAddress = process.env.SAFE_ADDRESS;
  if (!safeAddress) throw Error("No Safe address was provided");

  // Modify as needed, using Sepolia for testing
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw Error("No RPC URL was provided");

  const chainId = process.env.CHAIN_ID;
  if (!chainId) throw Error("No chain ID was provided");

  const config : SafeKitConfig = {
    network : hre.network.name,
    chainId: BigInt(chainId),
    rpcUrl,
    safeAddress,
    safeOwnerAddress: migrationAdmin.address,
    delay: Number(process.env.DELAY) || 10000, // ms to wait between proposing/executing transactions
    retryAttempts: Number(process.env.RETRIES) || 3, // Number of times to retry executing a tx if it fails
    db: client,
  };

  // Setup the SafeKit
  const safeKit = await SafeKit.init(config);

  // If admin given is not a Safe owner, fail early
  if (!await safeKit.isOwner(migrationAdmin.address)) {
    throw Error("Migration admin is not a Safe owner");
  }

  // We use this flag to separate root domain and subdomain registration
  // This is because gas estimation of a tx that includes registration of
  // a domain where a parent does not exist yet will fail. So the root domain batch
  // must be proposed *and* executed before subdomain registration can be proposed
  // Likewise, any transfers will fail gas estimation for domains that do not exist yet.

  // "roots" | "subs" | "transfers"
  const action = process.env.ACTION; // <--- Set this variable before each run as "roots", "subs", or "transfer"

  const zns = await getZNS(migrationAdmin);

  let transfers = [];

  switch (action) {
  case "roots":
    logger.info("Proposing root domain registrations...");
    const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Array<Domain>;

    transfers = await proposeRegistrations(
      await zns.rootRegistrar.getAddress(),
      safeKit,
      rootDomains,
      ROOT_DOMAIN_BULK_SELECTOR
    );

    // Store transfers for after execution of registrations
    await client.collection(`${ROOT_COLL_NAME}-transfers`).insertOne({ batches: transfers });
    break;
  case "subs":
    logger.info("Proposing subdomain registrations...");
    const subdomains = await client.collection(
      SUB_COLL_NAME
    ).find().sort({ depth: 1, _id: 1 }).toArray() as unknown as Array<Domain>;

    const depth = 1; // <--- This value must also be changed manually between each iteration
    const atDepth = subdomains.filter(d => d.depth === depth);

    // Store revoked parents, if we find any
    const revokedParents : Array<Partial<Domain>> = [];

    // Verify the existence of parent domains before proposing subdomain registration batches
    // Some may be missing in the subgraph, to be sure we recreate and register them
    for (const [i,d] of atDepth.entries()) {
      let parentHash;
      if (d.parent && d.parent.id) {
        parentHash = d.parent.id;
      } else if (d.parentHash) {
        parentHash = d.parentHash;
      } else {
        // Neither value is readable
        throw Error(`No parent information found for subdomain at ${i}: ${d.label}, ${d.id}`);
      }

      // Even with a single promise doing this reduces execution time
      const ownerPromise = zns.registry.getDomainOwner(parentHash);
      const [ owner ] = await Promise.all([ownerPromise]);
      if (owner === ZeroAddress) {
        // Recreate domain to have the information needed to re-register
        // Only needs to recreate the meaningful data from subgraph, `createBatches` takes care
        // of the rest
        const missingDomain : Partial<Domain> = {
          label: d.parent?.label,
          owner: {
            id: safeAddress,
            domains: [],
          },
          address: d.parent?.address || safeAddress,
          tokenURI: d.parent?.tokenURI || "http.zero.io",
          tokenId: d.parent?.tokenId,
          parentHash: d.parent?.parentHash || d.parent?.id,
          parent: {
            id: d.parent?.id,
          },
        };

        // If the missing parent is itself a subdomain, add `parentHash` and use `label` instead
        revokedParents.push(missingDomain);
      }
    }

    // If there are revoked parents, we propose those instead
    if (revokedParents.length > 0) {
      // We don't catch `transfers` here, we just want these for valid registration
      await proposeRegistrations(
        depth - 1 === 0 ? await zns.rootRegistrar.getAddress() : await zns.subRegistrar.getAddress(),
        safeKit,
        atDepth,
        depth - 1 === 0 ? ROOT_DOMAIN_BULK_SELECTOR : SUBDOMAIN_BULK_SELECTOR,
      );

      break;
    }

    transfers = await proposeRegistrations(
      await zns.subRegistrar.getAddress(),
      safeKit,
      atDepth,
      SUBDOMAIN_BULK_SELECTOR
    );

    await client.collection(`${SUB_COLL_NAME}-transfers`).insertOne({ batches: transfers });
    break;
  case "transfer":
    // Grab stored transfer txs from earlier runs
    const rootTransfers = client.collection(`${ROOT_COLL_NAME}-transfers`).find() as unknown as Array<string>;
    const subTransfers = client.collection(`${SUB_COLL_NAME}-transfers`).find() as unknown as Array<string>;

    await safeKit.createProposeSignedTxs(
      await zns.domainToken.getAddress(),
      [ ...rootTransfers, ...subTransfers ]
    );
    break;
  default:
    throw Error("Unknown action");
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});