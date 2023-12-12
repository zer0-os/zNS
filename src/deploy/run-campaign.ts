import { getConfig } from "./campaign/environments";
import { runZnsCampaign } from "./zns-campaign";
import { Defender } from "@openzeppelin/defender-sdk";

import { getLogger } from "./logger/create-logger";

const logger = getLogger();

const runCampaign = async () => {
  const credentials = {
    apiKey: process.env.DEFENDER_KEY,
    apiSecret: process.env.DEFENDER_SECRET,
    relayerApiKey: process.env.RELAYER_KEY,
    relayerApiSecret: process.env.RELAYER_SECRET,
  };

  const client = new Defender(credentials);

  const provider = client.relaySigner.getProvider();
  const deployer = client.relaySigner.getSigner(provider, { speed: "fast" });

  const config = await getConfig({
    deployer,
    governors: [await deployer.getAddress()],
    admins: [await deployer.getAddress()],
  });

  await runZnsCampaign({
    config,
    provider,
  });
};

runCampaign().catch(error => {
  process.exitCode = 1;
  logger.error(error);
}).finally(() => {
  process.exit(0);
});
