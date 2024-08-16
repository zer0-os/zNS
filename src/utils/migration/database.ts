import { MongoDBAdapter } from "@zero-tech/zdc";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { znsNames } from "../../deploy/missions/contracts/names";
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
  let version;
  let uri;
  if (hre.network.name === "hardhat") {
    // forking mainnet
    version = process.env.MONGO_DB_VERSION;
    uri = process.env.MONGO_DB_URI;
  } else if (hre.network.name === "sepolia") {
    // real spolia
    version = process.env.MONGO_DB_VERSION;
    uri = process.env.MONGO_DB_URI;
  } else {
    // TODO impl meowchain
    throw new Error("Invalid network name");
  }

  if (!uri || !version) {
    throw new Error("Failed to connect: missing MongoDB URI");
  }

  let dbAdapter = await getDBAdapter(uri);

  const dbName = process.env.MONGO_DB_TESTNET_NAME ?? process.env.MONGO_DB_NAME

  if(!dbName) {
    throw new Error(`Failed to connect: database "${dbName}" not found`);
  }

  const db = await dbAdapter.db(dbName);

  let zns = await db.collection("contracts").find(
    { version }
  ).toArray();

  return zns;
};
