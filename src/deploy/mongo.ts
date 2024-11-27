import { exec } from "child_process";
import { getMongoAdapter, TLogger } from "@zero-tech/zdc";
import { promisify } from "util";
import { getGitTag } from "../utils/git-tag/get-tag";
import { getZnsLogger } from "./logger";


const execAsync = promisify(exec);


export const getZnsMongoAdapter = async ({
  contractsVersion,
  logger,
  mongoConfig,
} : {
  contractsVersion ?: string;
  logger ?: TLogger;
  mongoConfig ?: {
    dbUri : string;
    dbName : string;
    dbVersion ?: string;
    archiveDb ?: boolean;
    clientOpts ?: Record<string, unknown>;
  };
} = {}) => {
  if (!contractsVersion) {
    contractsVersion = getGitTag();
  }

  if (!mongoConfig) {
    const {
      MONGO_DB_URI,
      MONGO_DB_NAME,
      MONGO_DB_VERSION,
      ARCHIVE_PREVIOUS_DB_VERSION,
      MONGO_DB_CLIENT_OPTS,
    } = process.env;

    mongoConfig = {
      dbUri: MONGO_DB_URI,
      dbName: MONGO_DB_NAME,
      dbVersion: MONGO_DB_VERSION,
      archiveDb: ARCHIVE_PREVIOUS_DB_VERSION === "true",
      clientOpts: !MONGO_DB_CLIENT_OPTS ? undefined : JSON.parse(MONGO_DB_CLIENT_OPTS),
    };
  }

  return getMongoAdapter({
    logger,
    contractsVersion,
    ...mongoConfig,
  });
};

export const startMongo = async () => {
  const logger = getZnsLogger();

  try {
    exec("npm run mongo:start");
    logger.info("MongoDB started");
  } catch (e) {
    logger.error({
      message: "Failed to start MongoDB Docker",
      error: e,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    throw new Error(e.message);
  }
};

export const stopMongo = async () => {
  const logger = getZnsLogger();

  try {
    await execAsync("npm run mongo:stop");
    logger.info("MongoDB stopped");
  } catch (e) {
    logger.error({
      message: "Failed to stop MongoDB Docker",
      error: e,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    throw new Error(e.message);
  }
};
