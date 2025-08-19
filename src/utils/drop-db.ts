import { startMongo, stopMongo, getZnsMongoAdapter } from "../deploy/mongo";
import { getZnsLogger } from "../deploy/get-logger";


export const dropDB = async (retries = 2) => {
  if (retries <= 0) return;

  try {
    const adapter = await getZnsMongoAdapter();
    await adapter.dropDB();
    await stopMongo();
  } catch (e) {
    const error = e as Error;
    console.error(
      `drop-db failed with error: ${error.message}\n${error.stack}.\nAttempting to retry...`,
    );
    await startMongo();
    await dropDB(retries - 1);
  }
};

dropDB()
  .then(() => process.exit(0))
  .catch(error => {
    getZnsLogger().debug(error);
    process.exit(1);
  });
