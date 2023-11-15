import * as hre from "hardhat";
import { getConfig } from "./campaign/environments";
import { getLogger } from "./logger/create-logger";
import { runZnsCampaign } from "./zns-campaign";

const runCampaign = async () => {
  const network = hre.network.name;

  const [deployer, zeroVault] = await hre.ethers.getSigners();

  const env = network === "hardhat" ? "dev" : "test";

  // Using the "test" environment so validation occurs
  const config = await getConfig(
    deployer,
    zeroVault,
    env,
  );

  const logger = getLogger();

  await runZnsCampaign({
    config,
    logger,
  });
};

runCampaign().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});
