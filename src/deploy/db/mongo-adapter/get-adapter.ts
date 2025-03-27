import { MongoDBAdapter } from "./mongo-adapter";
import { getLogger } from "../../logger/create-logger";
import { DEFAULT_MONGO_DB_NAME, DEFAULT_MONGO_URI } from "./constants";
import { TLogger } from "../../campaign/types";

let mongoAdapter : MongoDBAdapter | null = null;

export const resetMongoAdapter = () => {
  mongoAdapter = null;
};


export const getMongoAdapter = async (logger ?: TLogger) : Promise<MongoDBAdapter> => {
  logger = !logger ? getLogger() : logger;

  const params = {
    logger,
    dbUri: process.env.MONGO_DB_URI
      ? process.env.MONGO_DB_URI
      : DEFAULT_MONGO_URI,
    dbName: process.env.MONGO_DB_NAME
      ? process.env.MONGO_DB_NAME
      : DEFAULT_MONGO_DB_NAME,
    clientOpts: process.env.MONGO_DB_CLIENT_OPTS
      ? JSON.parse(process.env.MONGO_DB_CLIENT_OPTS)
      : undefined,
    version: process.env.MONGO_DB_VERSION
      ? process.env.MONGO_DB_VERSION
      : undefined,
    archive: process.env.ARCHIVE_PREVIOUS_DB_VERSION === "true",
  };

  if (mongoAdapter) {
    logger.debug("Returning existing MongoDBAdapter instance");
    return mongoAdapter;
  } else {
    logger.debug(`Creating new MongoDBAdapter instance with version: ${params.version}`);
    mongoAdapter = new MongoDBAdapter({
      ...params,
    });
    await mongoAdapter.initialize(params.version);
  }

  return mongoAdapter ;
};
