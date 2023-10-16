import { exec } from "child_process";
import { promisify } from "util";
import { TLogger } from "../campaign/types";


const execAsync = promisify(exec);

export const spawnTestMongo = async (logger : TLogger) => {
  try {
    exec("npm run mongo:start");
  } catch (e) {
    logger.error({
      message: "Failed to start MongoDB",
      error: e,
    });
    throw new Error(e.message);
  }

  logger.info("MongoDB started");
};
