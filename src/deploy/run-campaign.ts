import * as hre from "hardhat";
import { getConfig } from "./campaign/environments";
import { getLogger } from "./logger/create-logger";
import { runZnsCampaign } from "./zns-campaign";

const logger = getLogger();

const runCampaign = async () => {
  const [deployer, zeroVault] = await hre.ethers.getSigners();

  // Reading `ENV_LEVEL` environment variable to determine rules to be enforced
  const config = await getConfig(
    deployer,
    zeroVault,
  );

  await runZnsCampaign({
    config,
    logger,
  });
};

runCampaign().catch(error => {
  logger.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});
