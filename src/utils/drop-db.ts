import { startMongo, stopMongo, getZnsMongoAdapter } from "../deploy/mongo";
import { getZnsLogger } from "../deploy/get-logger";


export const dropDB = async () => {
  try {
    const adapter = await getZnsMongoAdapter();
    await adapter.dropDB();
    await stopMongo();
  } catch (e) {
    await startMongo();
    await dropDB();
  }
};

dropDB()
  .then(() => process.exit(0))
  .catch(error => {
    getZnsLogger().debug(error);
    process.exit(1);
  });
