import * as hre from "hardhat";
import { getConfig } from "./campaign/environments";
import { getLogger } from "./logger/create-logger";
import { runZnsCampaign } from "./zns-campaign";
import { Defender } from "@openzeppelin/defender-sdk";

const logger = getLogger();

const runCampaign = async () => {
  const [ zeroVault] = await hre.ethers.getSigners();
  const zeroVaultAddress = zeroVault.address;

  const credentials = {
    relayerApiKey: process.env.DEFENDER_KEY,
    relayerApiSecret: process.env.DEFENDER_SECRET,
  };

  const client = new Defender(credentials);

  const provider = client.relaySigner.getProvider();
  const deployer = client.relaySigner.getSigner(provider, { speed: "fast" });


  // Reading `ENV_LEVEL` environment variable to determine rules to be enforced
  const config = await getConfig({
    deployer,
    zeroVaultAddress,
  });

  await runZnsCampaign({
    config,
  });
};

runCampaign().catch(error => {
  logger.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});
