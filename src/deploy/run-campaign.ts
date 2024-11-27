import { getConfig } from "./campaign/get-config";
import { runZnsCampaign } from "./zns-campaign";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getZnsLogger } from "./logger";


const logger = getZnsLogger();

const runCampaign = async () => {

  const [ deployer ] = await hre.ethers.getSigners();

  const config = await getConfig({
    deployer: deployer as unknown as SignerWithAddress,
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
