import { MongoDBAdapter } from "./mongo-adapter";
import { getLogger } from "../../logger/create-logger";
import { DEFAULT_MONGO_DB_NAME, DEFAULT_MONGO_URI, DEFAULT_MONGO_VERSION } from "./constants";

let mongoAdapter : MongoDBAdapter | null = null;


export const getMongoAdapter = async () : Promise<MongoDBAdapter> => {
  const checkParams = {
    dbUri: process.env.MONGO_DB_URI
      ? process.env.MONGO_DB_URI
      : DEFAULT_MONGO_URI,
    dbName: process.env.MONGO_DB_NAME
      ? process.env.MONGO_DB_NAME
      : DEFAULT_MONGO_DB_NAME,
  };

  const logger = getLogger();

  const params = {
    logger,
    clientOpts: process.env.MONGO_DB_CLIENT_OPTS
      ? JSON.parse(process.env.MONGO_DB_CLIENT_OPTS)
      : undefined,
    version: process.env.MONGO_DB_VERSION
      ? process.env.MONGO_DB_VERSION
      : DEFAULT_MONGO_VERSION,
  };

  if (!checkParams.dbUri && !checkParams.dbName) {
    logger.info(
      "`MONGO_DB_URI` and `MONGO_DB_NAME` have not been provided by the ENV. Proceeding to use local defaults."
    );
    checkParams.dbUri = DEFAULT_MONGO_URI;
    checkParams.dbName = DEFAULT_MONGO_DB_NAME;
  }

  let createNew = false;
  if (mongoAdapter) {
    Object.values(checkParams).forEach(
      ([key, value]) => {
        if (key === "version") key = "curVersion";

        // if the existing adapter was created with different options than the currently needed one
        // we create a new one and overwrite
        if (JSON.stringify(mongoAdapter?.[key]) !== JSON.stringify(value)) {
          createNew = true;
          return;
        }
      }
    );
  } else {
    createNew = true;
  }

  if (createNew) {
    logger.debug("Creating new MongoDBAdapter instance");
    mongoAdapter = new MongoDBAdapter({
      ...checkParams,
      ...params,
    });
    await mongoAdapter.initialize(params.version);
  } else {
    logger.debug("Returning existing MongoDBAdapter instance");
  }

  return mongoAdapter as MongoDBAdapter;
};
