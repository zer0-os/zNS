import { MongoDBAdapter } from "@zero-tech/zdc";
import * as hre from "hardhat";

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
  let dbName;

  version = process.env.MONGO_DB_VERSION;
  uri = process.env.MONGO_DB_URI;
  dbName = process.env.MONGO_DB_NAME;

  if (!uri) {
    throw new Error("Failed to connect: missing MongoDB URI or version");
  }

  let dbAdapter = await getDBAdapter(uri);

  if(!dbName) {
    throw new Error(`Failed to connect: database "${dbName}" not found`);
  }

  const db = await dbAdapter.db(dbName);

  let zns = await db.collection("contracts").find(
    { version }
  ).toArray();

  return zns;
};
