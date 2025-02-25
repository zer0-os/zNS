import { exec } from "child_process";
import { getMongoAdapter, TLogger } from "@zero-tech/zdc";
import { promisify } from "util";
import { getGitTag } from "../utils/git-tag/get-tag";
import { getZnsLogger } from "./get-logger";


const execAsync = promisify(exec);


export const getZnsMongoAdapter = async ({
  contractsVersion,
  logger,
} : {
  contractsVersion ?: string;
  logger ?: TLogger;
} = {}) => {
  if (!contractsVersion) {
    contractsVersion = getGitTag();
  }

  return getMongoAdapter({
    logger,
    contractsVersion,
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
