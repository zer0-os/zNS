import { DEFAULT_MONGO_DB_NAME, getMongoAdapter, MongoDBAdapter } from "@zero-tech/zdc";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { znsNames } from "../../deploy/missions/contracts/names.ts";
import * as hre from "hardhat";
import { MeowToken__factory } from "@zero-tech/ztoken/typechain-js";

import { MongoClient, ServerApiVersion } from "mongodb";

let mongoAdapter : MongoDBAdapter | null = null;
export let dbVersion : string;

const getDBAdapter = async (connectionString : string): Promise<MongoClient> => {
  const mongoClient = new MongoClient(connectionString, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  return await mongoClient.connect();
}

export const getZNSFromDB = async () => {
  let version = process.env.MONGO_DB_VERSION ?? process.env.MONGO_DB_TESTNET_VERSION;
  let uri = process.env.MONGO_DB_URI ?? process.env.MONGO_DB_TESTNET_URI;

  let dbAdapter = await getDBAdapter(uri!);

  const dbName = process.env.MONGO_DB_TESTNET_NAME ?? process.env.MONGO_DB_NAME
  const db = await dbAdapter.db(dbName);

  let zns = await db.collection("contracts").find(
    { version }
  ).toArray();

  return zns;
};

export const getContractFromDB = async ({
  name,
  signer,
  action = "read" // Must be "read" or "write"
} : {
  name : string;
  signer ?: SignerWithAddress;
  action : string;
}) => {

  let dbAdapter;
  let contract;
  let version;
  let uri;
  // Get adapter based on "read" or "write" action
  if (action === "write") { // make sure "write" is the intentional logic path, not default
    version = process.env.MONGO_DB_TESTNET_VERSION ?? "1716322943505";

    uri = process.env.MONGO_DB_TESTNET_URI;
    dbAdapter = await getDBAdapter(uri!);

    const dbName = process.env.MONGO_DB_WRITE_NAME ?? "zns-meow-testnet-test";
    const db = await dbAdapter.db(dbName);

    // TODO wrap this in nicer code that abstracts the db call a bit
    contract = await db.collection("contracts").findOne({ name, version });
  } else {
    version = process.env.MONGO_DB_TESTNET_VERSION ?? process.env.MONGO_DB_VERSION;

    // TODO clean this up and remove the "write" " read" logic
    uri = process.env.MONGO_DB_TESTNET_URI;
    dbAdapter = await getDBAdapter(uri!);
  }

  // get all contracts in one call with version filter

  // if (!contract) throw new Error(`Contract "${name}" with version "${version}" not found in DB. Check name or version passed.`);

  let factory;
  if (name !== znsNames.meowToken.contract) {
    factory = await hre.ethers.getContractFactory(name, signer);
  } else {
    factory = new MeowToken__factory(signer);
  }

  if (!factory) throw new Error("Invalid contract name or db name is different from contract name");

  return factory.attach(contract.address);
};

