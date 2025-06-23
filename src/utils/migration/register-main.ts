import * as hre from "hardhat";
import { SafeKit } from "./safeKit";
import { Domain, SafeKitConfig } from "./types";
import { connect } from "./helpers";
import { ROOT_COLL_NAME, ROOT_DOMAIN_BULK_SELECTOR, SUB_COLL_NAME, SUBDOMAIN_BULK_SELECTOR } from "./constants";
import { proposeRegisterDomains } from "./proposeRegisterDomains";
import { getZNS } from "./zns-contract-data";

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
 * Required steps:
 * - ZNS v1.5 contracts must have been deployed to the target network
 * - ERC20 contract must have been deployed
 * - The Safe must already exist
 * - The Safe must have given approval for the ZNSTreasury to spend  
 * - The Safe must have the need ERC20 balance to register
 * - The Safe must have enough native token to fund the gas needed for each batch
 * 
 * Execution: After manually setting the `action` desired, run
 * `yarn hardhat run src/utils/migration/register-main.ts --network [NETWORK]
 * 
 * Note: Root domains must exist for subdomains to be minted. This will fail in
 * gas estimation otherwise, so we must propose *and* execute all root domains before
 * any subdomains.
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

  const config : SafeKitConfig = {
    network : hre.network.name,
    chainId: BigInt(process.env.CHAIN_ID!),
    rpcUrl: process.env.SEPOLIA_RPC_URL!, // Temporary, using Sepolia for testing
    safeAddress: process.env.SAFE_ADDRESS!,
    safeOwnerAddress: migrationAdmin.address,
  }

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
  // This is also true for any transfers. The domain must have been registered so the
  // appropriate tokenId exists for the transfer transaction to succeed
  let action = "subs"; // <--- Set this variable before each run as "roots", "subs", or "transfer"

  const zns = await getZNS(migrationAdmin);

  // Get domain data from different db
  const client = await connect();
  let transfers;
  switch (action) {
    case "roots":
      console.log("Proposing root domain registrations...");
      const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];

      transfers = await proposeRegisterDomains(
        await zns.rootRegistrar.getAddress(),
        safeKit,
        rootDomains,
        ROOT_DOMAIN_BULK_SELECTOR
      );
      // Store transfers for after execution of registrations
      client.collection(`${ROOT_COLL_NAME}-transfers`).insertMany(transfers);
      break;
    case "subs":
      console.log("Proposing subdomain registrations...");
      const subdomains = await client.collection(SUB_COLL_NAME).find().sort({ depth: 1, _id: 1}).toArray() as unknown as Domain[];

      transfers = await proposeRegisterDomains(
        await zns.subRegistrar.getAddress(),
        safeKit,
        subdomains.filter(d => d.depth === 1),
        SUBDOMAIN_BULK_SELECTOR
      );

      // Store transfers for after execution of registrations
      client.collection(`${SUB_COLL_NAME}-transfers`).insertMany(transfers);
      break;
    case "transfer":
      // Grab stored transfer txs from earlier runs
      const rootTransfers = client.collection(`${ROOT_COLL_NAME}-transfers`).find() as unknown as string[];
      const subTransfers = client.collection(`${SUB_COLL_NAME}-transfers`).find() as unknown as string[];

      await safeKit.createProposeSignedTxs(
        await zns.domainToken.getAddress(),
        [ ...rootTransfers, ...subTransfers ]
      )
      break;
    default:
      throw Error("Unknown action");
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});