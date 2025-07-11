import { Db, MongoClient, ServerApiVersion } from "mongodb";

export let dbVersion : string;

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

  const db = await dbAdapter.db(dbName);

  const zns = await db.collection("contracts").find(
    { version }
  ).toArray();

  return zns;
};

// Wrapper around `insertMany` mongo function
// That first drops the db name given and then verifies insertion quantity
export const insertMany = async <T extends Document>(
  client : Db,
  collectionName : string,
  documents : Array<T>
) => {
  await client.dropCollection(collectionName);
  const result = await client.collection(collectionName).insertMany(documents);
  const diff = documents.length - result.insertedCount;

  if (diff > 0) {
    throw new Error(
      `Error: call to "insertMany" on collection ${collectionName} failed to insert ${diff} documents`
    );
  }
}