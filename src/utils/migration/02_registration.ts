import * as hre from "hardhat";
import { SafeKit } from "./safeKit";
import { Domain, SafeKitConfig } from "./types";
import {
  connectToDb,
  createRevokes,
  createTransfers,
  getSubdomainParentHash,
  proposeRegistrations,
} from "./helpers";
import {
  INVALID_REVOKES_COLL_NAME,
  INVALID_TX_COLL_NAME,
  ROOT_COLL_NAME,
  ROOT_DOMAIN_BULK_SELECTOR,
  SUB_COLL_NAME,
  SUBDOMAIN_BULK_SELECTOR,
} from "./constants";
import { getZNS } from "./zns-contract-data";
import { ZeroAddress } from "ethers";
import { getZnsLogger } from "../../deploy/get-logger";

/**
 * ZNS Domain Migration Registration Script
 *
 * Creates and proposes signed transactions to the Safe for domain registration
 * as part of the second half of the ZNS domain migration process.
 *
 * This script retrieves the latest ZNS contracts and domain information from MongoDB,
 * then forms the data into batches of encoded transaction data to propose to the Safe.
 *
 * @requires Environment Variables:
 * - MONGO_DB_URI - MongoDB connection for ZNS contracts
 * - MONGO_DB_NAME - MongoDB database name with contracts
 * - MONGO_DB_VERSION - MongoDB version with contracts
 * - MONGO_DB_URI_WRITE - MongoDB connection for domain data (different cluster)
 * - MONGO_DB_NAME_WRITE - Write database name
 * - SAFE_ADDRESS - Gnosis Safe contract address
 * - SAFE_OWNER - Safe owner private key (for HardHat config)
 * - CHAIN_ID - Target blockchain chain ID
 * - [NETWORK]_RPC_URL - RPC URL for the specific network
 * - ACTION - Action type: "roots", "subs", "transfers", "revoke"
 *
 * @optional Environment Variables:
 * - TX_SERVICE_URL - Safe transaction service URL (only for unsupported networks)
 * - DELAY - Delay between transactions in milliseconds (default: 10000)
 * - RETRIES - Number of retry attempts (default: 3)
 *
 * @prerequisites:
 * - ZNS v2 contracts deployed to target network
 * - ERC20 contract deployed to target network
 * - Gnosis Safe must exist and be configured
 * - Safe must have approval for ZNSTreasury to spend tokens
 * - Contracts need to be configured to have price 0 for root domains
 * - Safe must have sufficient native tokens for gas fees
 *
 * @usage:
 * Set ACTION environment variable to "roots", "subs", "transfers" or "revoke", then run:
 * `yarn hardhat run src/utils/migration/02_registration.ts --network [NETWORK]`
 *
 * @important:
 * - Parent domains must exist before child domains can be registered
 * - Root domains must be proposed AND executed before subdomains
 * - Executing more than ~20 transactions sequentially is not recommended
 * - Manual gas estimation is used for complex transaction accuracy
 */
export const migration = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const logger = getZnsLogger();

  // Get domain data from different db
  const client = await connectToDb();

  const safeAddress = process.env.SAFE_ADDRESS;
  if (!safeAddress) throw new Error("No Safe address was provided. Set SAFE_ADDRESS environment variable");

  // Modify as needed
  const rpcUrl = process.env.ZEPHYR_RPC_URL;
  if (!rpcUrl) throw new Error("No RPC URL was provided. Set ..._RPC_URL environment variable for your network");

  const chainId = process.env.CHAIN_ID;
  if (!chainId) throw new Error("No chain ID was provided. Set CHAIN_ID environment variable");

  const config : SafeKitConfig = {
    network : hre.network.name,
    chainId: BigInt(chainId),
    rpcUrl,
    safeAddress,
    safeOwnerAddress: migrationAdmin.address,
    delay: Number(process.env.DELAY) || 10000, // ms to wait between proposing/executing transactions
    retryAttempts: Number(process.env.RETRIES) || 3, // Number of times to retry executing a tx if it fails
    db: client,
    txServiceUrl: process.env.TX_SERVICE_URL, // Optional, specify only when using a network not supported by Safe
  };

  // For more information on what networks are supported by Safe, read more below
  /* eslint-disable-next-line max-len */
  // https://docs.safe.global/advanced/smart-account-supported-networks?service=Transaction+Service&service=Safe%7BCore%7D+SDK

  // Setup the SafeKit
  const safeKit = await SafeKit.init(config);

  // If the admin given is not a Safe owner, fail early
  if (!await safeKit.isOwner(migrationAdmin.address)) {
    throw new Error(
      `Migration admin ${migrationAdmin.address} is not a Safe owner.
          Ensure the admin address is added as a Safe owner`
    );
  }

  // We use this flag to separate root domain and subdomain registration
  // This is because gas estimation of a tx that includes registration of
  // a domain where a parent does not exist yet will fail. So the root domain batch
  // must be proposed *and* executed before subdomain registration can be proposed
  // Likewise, any transfers will fail gas estimation for domains that do not exist yet.

  // "roots" | "subs" | "transfers" | "revoke"
  const action = process.env.ACTION; // <--- Set this variable before each run as "roots", "subs", or "transfer"

  const zns = await getZNS(migrationAdmin);

  const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Array<Domain>;
  const subdomains = await client.collection(
    SUB_COLL_NAME
  ).find().sort({ depth: 1, _id: 1 }).toArray() as unknown as Array<Domain>;

  switch (action) {
  case "roots":
    logger.info("Proposing root domain registrations...");

    if (!safeKit) {
      throw new Error(
        "SafeKit is not initialized. Ensure you are running this script with a valid Safe configuration."
      );
    }

    await proposeRegistrations(
      await zns.rootRegistrar.getAddress(),
      safeKit,
      rootDomains,
      ROOT_DOMAIN_BULK_SELECTOR
    );

    break;
  case "subs":
    logger.info("Proposing subdomain registrations...");

    const depth = 1; // <--- This value must also be changed manually between each iteration
    const atDepth = subdomains.filter(d => d.depth === depth);

    // Store revoked parents, if we find any
    const revokedParents : Map<string, Partial<Domain>> = new Map();

    // Verify the existence of parent domains before proposing subdomain registration batches
    // Some may be missing in the subgraph, to be sure we recreate and register them
    for (const domain of atDepth) {
      const parentHash = getSubdomainParentHash(domain);

      // Even with a single promise doing this reduces execution time
      const ownerPromise = zns.registry.getDomainOwner(parentHash);
      const [ owner ] = await Promise.all([ownerPromise]);
      if (owner === ZeroAddress) {
        // Recreate domain to have the information needed to re-register
        // Only needs to recreate the meaningful data from subgraph, `createBatches` takes care
        // of the rest
        const missingParent : Partial<Domain> = {
          label: domain.parent?.label,
          owner: {
            id: safeAddress,
            domains: [],
          },
          address: domain.parent?.address || ZeroAddress,
          tokenURI: domain.parent?.tokenURI || "http.zero.io",
          tokenId: domain.parent?.tokenId,
          parentHash: domain.parent?.parent?.parentHash || ZeroAddress,
          parent: {
            id: domain.parent?.parent?.id || ZeroAddress,
          },
        };

        // If the missing parent is itself a subdomain, add `parentHash` and use `label` instead
        if (!revokedParents.has(parentHash)) {
          revokedParents.set(parentHash, missingParent);
        }
      }
    }

    if (!safeKit) {
      throw new Error(
        "SafeKit is not initialized. Ensure you are running this script with a valid Safe configuration."
      );
    }

    // If there are revoked parents, we propose those instead
    if (revokedParents.size > 0) {
      // We don't catch `transfers` here, we just want these for valid registration
      await proposeRegistrations(
        depth - 1 === 0 ? await zns.rootRegistrar.getAddress() : await zns.subRegistrar.getAddress(),
        safeKit,
        [ ...revokedParents.values() ] as Array<Domain>,
        depth - 1 === 0 ? ROOT_DOMAIN_BULK_SELECTOR : SUBDOMAIN_BULK_SELECTOR,
      );

      break;
    }

    await proposeRegistrations(
      await zns.subRegistrar.getAddress(),
      safeKit,
      atDepth,
      SUBDOMAIN_BULK_SELECTOR
    );

    break;
  case "transfers":
    const [ transferTxs, failedTransferTxs ] = await createTransfers(
      zns.domainToken,
      [...rootDomains, ...subdomains],
    );

    if (failedTransferTxs.length > 0) {
      const result = await client.collection(INVALID_TX_COLL_NAME).insertMany(failedTransferTxs);
      const diff = failedTransferTxs.length - result.insertedCount;
      if (diff > 0) {
        throw new Error(`Failed to insert ${diff} failed domain transfers`);
      }
    }

    if (!safeKit) {
      throw new Error(
        "SafeKit is not initialized. Ensure you are running this script with a valid Safe configuration."
      );
    }

    // Create and propose the batch transactions
    await safeKit.createProposeBatches(transferTxs, 100);
    break;
  case "revoke":
    const domainsToRevoke = [
      ...rootDomains.filter(domain => domain.isRevoked),
      ...subdomains.filter(domain => domain.isRevoked),
    ];

    // Revoke domains that are owned by the Safe
    const {
      revokeTxs,
      failedRevokes,
    } = await createRevokes(
      domainsToRevoke,
      zns.rootRegistrar,
      safeAddress,
    );

    if (failedRevokes.length > 0) {
      const result = await client.collection(INVALID_REVOKES_COLL_NAME).insertMany(failedRevokes);
      const diff = failedRevokes.length - result.insertedCount;
      if (diff > 0) {
        throw new Error(`Failed to insert ${diff} failed domain revocations`);
      }
    }

    if (!safeKit) {
      throw new Error(
        "SafeKit is not initialized. Ensure you are running this script with a valid Safe configuration."
      );
    }

    // Create and propose the batch transactions
    await safeKit.createProposeBatches(revokeTxs, 100);

    break;
  default:
    throw new Error(`Unknown action: "${action}". Valid actions are: "roots", "subs", or "transfers"`);
  }
};

migration().catch(error => {
  getZnsLogger().error("Migration script failed:", error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});
