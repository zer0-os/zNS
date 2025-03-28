import * as hre from "hardhat";
import { getConfig } from "./campaign/environments";
import { runZnsCampaign } from "./zns-campaign";
import { getLogger } from "./logger/create-logger";


const logger = getLogger();

const runCampaign = async () => {
  const [ deployer ] = await hre.ethers.getSigners();


  const config = await getConfig({
    deployer,
  });

  await runZnsCampaign({
    config,
  });
};

runCampaign().catch(error => {
  logger.error(error.stack);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
