import { getLogger } from "@zero-tech/zdc";
import { startMongo, stopMongo, getZnsMongoAdapter } from "../deploy/mongo";


const logger = getLogger();

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
    logger.debug(error);
    process.exit(1);
  });
