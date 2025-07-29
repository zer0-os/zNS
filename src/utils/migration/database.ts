import { MongoClient, ServerApiVersion } from "mongodb";

export const getDBAdapter = async (
  connectionString : string
) : Promise<MongoClient> => {
  const mongoClient = new MongoClient(
    connectionString,
    {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    }
  );

  return mongoClient.connect();
};

export const getZNSFromDB = async () => {
  const version = process.env.MONGO_DB_VERSION;
  const uri = process.env.MONGO_DB_URI;
  const dbName = process.env.MONGO_DB_NAME;

  if (!uri) {
    throw new Error("Failed to connect: missing MongoDB URI or version");
  }

  const dbAdapter = await getDBAdapter(uri);

  if(!dbName) {
    throw new Error(`Failed to connect: database "${dbName}" not found`);
  }

  if(!version) {
    throw new Error("Failed to connect: version is not provided");
  }

  const db = await dbAdapter.db(dbName);

  const zns = await db.collection("contracts").find(
    { version }
  ).toArray();

  return zns;
};