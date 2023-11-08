import { getMongoAdapter } from "../src/deploy/db/mongo-connect/adapter";


export const mochaGlobalSetup = async () => {
  await getMongoAdapter();
};

export const mochaGlobalTeardown = async () => {
  const mongoAdapter = await getMongoAdapter();
  // TODO dep: unblock this if needed
  // await mongoAdapter.dropDB();
  await mongoAdapter.close();
};
