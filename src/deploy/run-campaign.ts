import * as hre from "hardhat";
import { getConfig } from "./campaign/environments";
// import { getLogger } from "./logger/create-logger";
import { runZnsCampaign } from "./zns-campaign";

import { 
  ethers,
  defender
} from "hardhat";

import { Defender } from "@openzeppelin/defender-sdk";
// import { DeployClient } from "@openzeppelin/defender-sdk-deploy-client";
import { DefenderRelayProvider, DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";

// import { DeployContractRequest } from "@openzeppelin/defender-sdk-deploy-client/lib/models";
import { IDeployCampaignConfig } from "./campaign/types";
import { BaseContract, ContractFactory, Signer } from "ethers";

// const logger = getLogger();

const runCampaign = async () => {

  // doesn't return ContractFactory<any[], BaseContract> ?
  // const factory = await ethers.getContractFactory("ZNSRegistry");
  
  // OZ tutorial for deployment
  // https://docs.openzeppelin.com/defender/v2/tutorial/deploy#deploy
  // const upgradeApprovalProcess = await defender.getUpgradeApprovalProcess();

  const credentials = {
    apiKey: process.env.DEFENDER_KEY,
    apiSecret: process.env.DEFENDER_SECRET,
    relayerApiKey: process.env.RELAYER_KEY,
    relayerApiSecret: process.env.RELAYER_SECRET,
  };

  const client = new Defender(credentials);

  const provider : DefenderRelayProvider = client.relaySigner.getProvider();
  const signer : DefenderRelaySigner = client.relaySigner.getSigner(provider, { speed: "fast" });

  const myConfig : IDeployCampaignConfig = await getConfig({
    deployAdmin: signer,
    governors: [await signer.getAddress()],
    admins: [await signer.getAddress()]
  });

  await runZnsCampaign({
    config: myConfig,
    client: client,
  });
};

runCampaign().catch(error => {
  console.log(error.message);
});
