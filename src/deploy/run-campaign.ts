import * as hre from "hardhat";
import { getConfig } from "./campaign/environments";
import { getLogger } from "./logger/create-logger";
import { runZnsCampaign } from "./zns-campaign";
import { Defender } from "@openzeppelin/defender-sdk";

const logger = getLogger();

const runCampaign = async () => {
  // const [ zeroVault] = await hre.ethers.getSigners();
  // const zeroVaultAddress = zeroVault.address;

  const credentials = {
    relayerApiKey: process.env.RELAYER_KEY,
    relayerApiSecret: process.env.RELAYER_SECRET,
  };

  const client = new Defender(credentials);

  const provider = client.relaySigner.getProvider();
  // TODO def: figure out how many seconds to pass here or use default !!!
  const deployer = client.relaySigner.getSigner(provider, { speed: "fast", validForSeconds: 120 });


  // Reading `ENV_LEVEL` environment variable to determine rules to be enforced
  const config = await getConfig({
    deployer,
  });

  await runZnsCampaign({
    config,
  });
};

runCampaign().catch(error => {
  logger.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});
