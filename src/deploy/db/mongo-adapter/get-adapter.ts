import { MongoDBAdapter } from "./mongo-adapter";
import { getLogger } from "../../logger/create-logger";
import { mongoDbName, mongoURILocal } from "./constants";

let mongoAdapter : MongoDBAdapter | null = null;


export const getMongoAdapter = async () : Promise<MongoDBAdapter> => {
  const checkParams = {
    // TODO dep: fix type asserion error here
    dbUri: process.env.MONGO_DB_URI!,
    dbName: process.env.MONGO_DB_NAME!,
  };

  const logger = getLogger();

  const params = {
    logger,
    clientOpts: !!process.env.MONGO_DB_CLIENT_OPTS
      ? JSON.parse(process.env.MONGO_DB_CLIENT_OPTS)
      : undefined,
    // TODO dep: add better way to set version ENV var is not the best !
    version: process.env.MONGO_DB_VERSION,
  };

  if (!checkParams.dbUri && !checkParams.dbName) {
    logger.info("`MONGO_DB_URI` and `MONGO_DB_NAME` have not been provided by the ENV. Proceeding to use defaults.");
    checkParams.dbUri = mongoURILocal;
    checkParams.dbName = mongoDbName;
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
