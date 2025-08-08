import { logger } from "@tenderly/hardhat-tenderly/dist/logger";
import { getZnsMongoAdapter } from "../src/deploy/mongo";
import { setDefaultEnvironment } from "../src/environment/set-env";


export const mochaGlobalSetup = async () => {
  // This will set the default environment variables before running any hardhat scripts
  // most of this code relies on. This is needed to ensure that the default environment for tests is set
  // up correctly before running any scripts on any machine, including CI, and is not dependent
  // on the default environment variables set in the .env file.
  // The environment CAN still be overridden by the .env file, but this is the default setup.
  // If the current network is hardhat, this will NOT use your local .env file to prevent accidental errors.
  setDefaultEnvironment(false);

  await getZnsMongoAdapter();
};

export const mochaGlobalTeardown = async () => {
  const mongoAdapter = await getZnsMongoAdapter();

  if (process.env.ENV_LEVEL === "dev") {
    await mongoAdapter.dropDB();
    logger.info("Dropped MongoDB database for `dev` enviroment.");
  } else {
    logger.info(
      "Skipping MongoDB database drop for non-dev environment. " +
      "This is to prevent accidental data loss in production or staging environments."
    );
  }

  await mongoAdapter.close();
};
