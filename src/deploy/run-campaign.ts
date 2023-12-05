import { getConfig } from "./campaign/environments";
import { getLogger } from "./logger/create-logger";
import { runZnsCampaign } from "./zns-campaign";
import { Defender } from "@openzeppelin/defender-sdk";
import * as hre from "hardhat";

const logger = getLogger();

const runCampaign = async () => {
  const [ user ] = await hre.ethers.getSigners();
  // const zeroVaultAddress = zeroVault.address;

  const credentials = {
    apiKey: process.env.DEFENDER_KEY,
    apiSecret: process.env.DEFENDER_SECRET,
    relayerApiKey: process.env.RELAYER_KEY,
    relayerApiSecret: process.env.RELAYER_SECRET,
  };

  const client = new Defender(credentials);

  const provider = client.relaySigner.getProvider();
  // TODO def: figure out how many seconds to pass here or use default !!!
  const deployer = client.relaySigner.getSigner(provider, { speed: "fast", validForSeconds: 120 });

  // TODO check verification on etherscan
  // TODO make sure subsequent passes work after initial first pass success

  // Error on first pass when attempting verification
  // Reading `ENV_LEVEL` environment variable to determine rules to be enforced
  const config = await getConfig({
    deployer,
    governors: [await deployer.getAddress()],
    admins: [user.address, await deployer.getAddress()],
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
