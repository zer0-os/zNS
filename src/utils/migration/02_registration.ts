import * as hre from "hardhat";
import { getZNS } from "./zns-contract-data";
import { getDBAdapter } from "./database";
import { IZNSContracts } from "../../../test/helpers/types";

// We will need to adjust this file in the future no matter what after merging happens
// ignore this file for now
/* eslint-disable */
/* @typescript-eslint-disable */


// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  // Overall flow will be:
  // connect to DB
  // read all roots from mongodb
  // while there are unregistered root domains:
  //  register a batch

  // read all subs with depth 1 from mongodb
  // while there are unregistered subdomains:
  //  register a batch
  // read all subs with depth 2 from mongodb
  // while there are unregistered subdomains:
  //  register a batch
  // read all subs with depth 3 from mongodb
  // while there are unregistered subdomains:
  //  register a batch

  // During above we will pack transactions with to always have 50 domains
  // so if only 45 root domains remain at the end, we will also send the first 5 depth 1 subdomains

  // Steps to register a batch will mean using the Safe REST API to create a transaction
  // for the owning safe that calls `registerRootDomainBulk` or `registerSubdomainBulk`
  // Then we will wait for the transaction to be executed
  // Technically we could also sign each tx and execute this way

  let zns : IZNSContracts;

  const env = process.env.ENV_LEVEL;

  if (!env) throw Error("No ENV_LEVEL set in .env file");

  // Get instance of ZNS from DB
  zns = await getZNS(migrationAdmin, env);

  // Connect to database collection and write user domain data to DB
  const dbName = process.env.MONGO_DB_NAME_WRITE;
  if (!dbName) throw Error("No DB name given");

  const uri = process.env.MONGO_DB_URI_WRITE;
  if (!uri) throw Error("No connection string given");

  const client = (await getDBAdapter(uri)).db(dbName);

  const rootCollName = process.env.MONGO_DB_ROOT_COLL_NAME || "root-domains";

  // Get all documents from collection
  const domains = await client.collection(rootCollName).find().toArray();

  console.log(domains.length);

  const startTime = Date.now();

  // How many domains we will register in a single transaction
  const sliceSize = 50;

  process.exit(0);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
