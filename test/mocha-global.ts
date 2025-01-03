import { getMongoAdapter } from "../src/deploy/db/mongo-adapter/get-adapter";


export const mochaGlobalSetup = async () => {
  await getMongoAdapter();
};

export const mochaGlobalTeardown = async () => {
  const mongoAdapter = await getMongoAdapter();
  // the next line can be commented out to leave the DB after test to manually test
  // await mongoAdapter.dropDB();
  await mongoAdapter.close();
};
