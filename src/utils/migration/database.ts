import { getMongoAdapter, MongoDBAdapter } from "@zero-tech/zdc";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { znsNames } from "../../deploy/missions/contracts/names.ts";
import * as hre from "hardhat";
import { MeowToken__factory } from "@zero-tech/ztoken/typechain-js";

import { MongoClient, ServerApiVersion } from "mongodb";

let mongoAdapter : MongoDBAdapter | null = null;
export let dbVersion : string;

const getDBAdapterLocal = async (): Promise<MongoClient> => {
  const mongoClient = new MongoClient(process.env.MONGO_DB_WRITE_URI!, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  return await mongoClient.connect();
}

const getDBAdapter = async () => {
  if (!process.env.MONGO_DB_VERSION)
    throw new Error("MONGO_DB_VERSION is not defined. A current version you want to read from is required!");

  dbVersion = process.env.MONGO_DB_VERSION;

  if (!mongoAdapter) {
    mongoAdapter = await getMongoAdapter();
  }

  return mongoAdapter;
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

  // Get adapter based on "read" or "write" action
  if (action === "write") { // make sure "write" is the intentional logic path, not default
    version = process.env.MONGO_DB_WRITE_VERSION ?? "1716322943505";

    dbAdapter = await getDBAdapterLocal();
    const dbName = process.env.MONGO_DB_WRITE_NAME ?? "zns-meow-testnet-test";
    const db = await dbAdapter.db(dbName);

    // TODO wrap this in nicer code that abstracts the db call a bit
    contract = await db.collection("contracts").findOne({ name, version });
  } else {
    version = process.env.MONGO_DB_VERSION ?? "1703976278937";

    dbAdapter = await getDBAdapter();
    contract = await dbAdapter.getContract(
      name,
      version,
    );
  }

  if (!contract) throw new Error(`Contract "${name}" with version "${version}" not found in DB. Check name or version passed.`);

  let factory;
  if (name !== znsNames.meowToken.contract) {
    factory = await hre.ethers.getContractFactory(name, signer);
  } else {
    factory = new MeowToken__factory(signer);
  }

  if (!factory) throw new Error("Invalid contract name or db name is different from contract name");

  return factory.attach(contract.address);
};

