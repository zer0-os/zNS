import { getZnsMongoAdapter } from "../src/deploy/mongo";


export const mochaGlobalSetup = async () => {
  if (!process.env.MONGO_DB_URI!.includes("localhost"))
    throw new Error("Possibly running wrong .env file! MONGO_DB_URI must be 'localhost' for testing!");
  await getZnsMongoAdapter();
};

export const mochaGlobalTeardown = async () => {
  const mongoAdapter = await getZnsMongoAdapter();
  // the next line can be commented out to leave the DB after test to manually test
  await mongoAdapter.dropDB();
  await mongoAdapter.close();
};
