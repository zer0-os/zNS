import { getMongoAdapter } from "../deploy/db/mongo-adapter/get-adapter";
import { startMongo, stopMongo } from "../deploy/db/service/mongo-service";
import { getLogger } from "../deploy/logger/create-logger";


const logger = getLogger();

export const dropDB = async () => {
  try {
    const adapter = await getMongoAdapter();
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
    logger.debug(error);
    process.exit(1);
  });
