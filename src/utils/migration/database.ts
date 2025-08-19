import { Db, MongoClient, ServerApiVersion, Document } from "mongodb";

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

export const updateCollection = async <T extends Document> (
  client : Db,
  collName : string,
  documents : Array<T>,
) => {
  // To avoid duplicate data, we clear the DB before any inserts
  await client.dropCollection(collName);

  const result = await client.collection(collName).insertMany(documents);
  const diff = documents.length - result.insertedCount;

  if (diff > 0) {
    throw new Error(`Error: Failed to insert ${diff} domains on call to \`insertMany\``);
  }
};