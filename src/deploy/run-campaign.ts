import { getConfig } from "./campaign/environments";
import { runZnsCampaign } from "./zns-campaign";
import { Defender } from "@openzeppelin/defender-sdk";

// import { DefenderRelayProvider, DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";

// import { IDeployCampaignConfig } from "./campaign/types";
// import { BaseContract, ContractFactory, Signer } from "ethers";


const runCampaign = async () => {
  const credentials = {
    apiKey: process.env.DEFENDER_KEY,
    apiSecret: process.env.DEFENDER_SECRET,
    relayerApiKey: process.env.RELAYER_KEY,
    relayerApiSecret: process.env.RELAYER_SECRET,
  };

  const client = new Defender(credentials);

  const provider = client.relaySigner.getProvider();
  // TODO def: figure out how many seconds to pass here or use default !!!
  const deployer = client.relaySigner.getSigner(provider, { speed: "fast" });

  // TODO check verification on etherscan
  // TODO make sure subsequent passes work after initial first pass success

  // Error on first pass when attempting verification
  // Reading `ENV_LEVEL` environment variable to determine rules to be enforced
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
  console.log(error);
}).finally(() => {
  process.exit(0);
});
