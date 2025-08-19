import * as hre from "hardhat";
import { Db } from "mongodb";
import { getDomains } from "./subgraph";
import { Domain, InvalidDomain } from "./types";
import { getDBAdapter, updateCollection } from "./database";
import { getZNS } from "./zns-contract-data";
import { validateDomain } from "./validate";
import { INVALID_COLL_NAME, ROOT_COLL_NAME, SUB_COLL_NAME } from "./constants";

import { getLogger } from "../../deploy/logger/create-logger";

const logger = getLogger();

/**
 * This is the first of 3 scripts required to run the full domain migration process for zNS v1.0 -> v2.0
 *
 * 01_validation.ts - Collect Ethereum mainnet domain data for zNS from the subgraph and validate
 * it's legitimacy against actual on-chain data. Once validated it is uploaded to database for
 * access in downstream functions
 *
 * 02_registration.ts - Read domain data collected by step #1 and form batches of domain registration
 * calls for the `bulk` functions present on zNS v2.0 and propose them to the Safe instance on Z Chain.
 * We do this level by level so script requires multiple steps as the lack of parent domains existing will
 * cause subdomains of that domain to fail gas estimation for the batch. We then also call to transfer to
 * transfer each registered domain to the rightful owner. Domains that are revoked must be registered to
 * successfully register any subdomains, so these domains are left out of the transfer. As a result the final
 * owner for these domains is the Safe and the final execution will call to revoke all of these domains
 * specifically so that the namespace is available for users in the future.
 * **Note** This script is NOT present on this branch. Switch to branch `rc/zchain-native-main`
 *
 * 03_airdrop.ts - As the final step we seek to reimburse the original domain holders on L1. This script
 * aggregates how much each user has paid in total and in what token and then writes that data to a .csv file
 * We can upload this file directly to the L1 Safe using the `CSV Airdrop` app enabled by them directly.
 *
 * Reqiuired .env vars
 * - SUBGRAPH_URL_DEV - The URL to read from `zns-mainnet-dev` subgraph
 * - MAINNET_PRIVATE_KEY - A **READ ONLY** private key to use in validation on chain
 * - MAINNET_RPC_URL
 * - MONGO_DB_URI - For read only access to mainnet contracts
 * - MONGO_DB_NAME
 * - MONGO_DB_VERSION
 * - MONGO_DB_URI_WRITE - For writing valid collections to a separate database
 * - MONGO_DB_NAME_WRITE
 * - ENV_LEVEL - Should be set to `prod` with  **READ ONLY** private key in hardhat to read mainnet contracts
 */
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  // Keeping as separate collections from the start will help downstream registration
  const rootDomainObjects = await getDomains(true);
  const subdomainObjects = await getDomains(false);

  logger.info(`Found ${rootDomainObjects.length + subdomainObjects.length} domains`);

  const env = process.env.ENV_LEVEL;

  if (!env) throw Error("No ENV_LEVEL set in .env file");

  const zns = await getZNS(migrationAdmin, env);

  const validRoots : Array<Domain> = [];
  const validSubs : Array<Domain> = [];
  const invalidDomains : Array<InvalidDomain> = [];

  // Doing this creates strong typing and extensibility that allows
  // the below `insertMany` calls to add properties to the object for `_id` properly
  const roots = rootDomainObjects.map(d => d as Domain);
  logger.info(`Found ${roots.length} root domains`);

  const subs = subdomainObjects.map(d => d as Domain);
  logger.info(`Found ${subs.length} subdomains`);

  const dbName = process.env.MONGO_DB_NAME_WRITE;
  if (!dbName) throw Error("Missing MONGO_DB_NAME_WRITE environment variable");

  const uri = process.env.MONGO_DB_URI_WRITE;
  if (!uri) throw Error("No connection string given");

  // Can iterate all at once for simplicity
  let index = 0;
  for(const domain of [...roots, ...subs]) {
    try {
      // Revoked domains are kept in the subgraph for data integrity
      // but will not match any onchain data, so we can skip
      if (!domain.isRevoked) {
        await Promise.all([validateDomain(domain, zns)]);
      }

      if (domain.isWorld) {
        validRoots.push({ ...domain } as Domain);
      } else {
        validSubs.push({ ...domain } as Domain);
      }
    } catch (e) {
      // For debugging we keep invalid domains rather than throw errors
      invalidDomains.push({ message: (e as Error).message, domain });
    }

    ++index;

    if (index % 50 === 0) {
      logger.info(`Processed ${index} domains`);
    }
  }

  // Connect to database collection and write user domain data to DB
  const client : Db = (await getDBAdapter(uri)).db(dbName);

  await updateCollection(
    client,
    ROOT_COLL_NAME,
    validRoots
  );

  await updateCollection(
    client,
    SUB_COLL_NAME,
    validSubs
  );

  // Domains that have data inconsistencies
  if (invalidDomains.length > 0) {
    await updateCollection(
      client,
      INVALID_COLL_NAME,
      invalidDomains
    );
  }
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
