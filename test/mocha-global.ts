import { getZnsMongoAdapter } from "../src/deploy/mongo";


export const mochaGlobalSetup = async () => {
  await getZnsMongoAdapter();
};

export const mochaGlobalTeardown = async () => {
  const mongoAdapter = await getZnsMongoAdapter();
  // the next line can be commented out to leave the DB after test to manually test
  await mongoAdapter.dropDB();
  await mongoAdapter.close();
};
