import { getMongoAdapter, getLogger } from "@zero-tech/zdc";
import { startMongo, stopMongo } from "../deploy/mongo-service";


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
