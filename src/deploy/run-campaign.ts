import { getCampaignConfig } from "./campaign/environments";
import { runZnsCampaign } from "./zns-campaign";
import { Defender } from "@openzeppelin/defender-sdk";
import { getLogger } from "@zero-tech/zdc";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

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

  const config = await getCampaignConfig({
    deployer: deployer as unknown as SignerWithAddress,
  });

  await runZnsCampaign({
    config,
    provider,
  });
};

runCampaign().catch(error => {
  logger.error(error.stack);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
