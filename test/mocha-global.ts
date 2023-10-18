import { getMongoAdapter } from "../src/deploy/db/mongo-connect/mongo-adapter";
import { spawnTestMongo, stopTestMongo } from "../src/deploy/db/test-mongo";


export const mochaGlobalSetup = async () => {
  // spawn test Mongo instance
  await spawnTestMongo();

  await getMongoAdapter();
};

export const mochaGlobalTeardown = async () => {
  const mongoAdapter = await getMongoAdapter();
  // TODO dep: unblock this if needed
  // await mongoAdapter.dropDB();
  await mongoAdapter.close();

  await stopTestMongo();
};
