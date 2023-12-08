import * as hre from "hardhat";
// import { getConfig } from "./campaign/environments";
// import { getLogger } from "./logger/create-logger";
// import { runZnsCampaign } from "./zns-campaign";

import { ethers, defender } from "hardhat";

// import { Defender } from "hardhat/plugins"; // TODO how to get from HH?

// import { Defender } from "@openzeppelin/defender-sdk";
// should get defender
// import { DeployContractRequest } from "@openzeppelin/defender-sdk-deploy-client/lib/models";

// import { DefenderRelaySigner, DefenderRelayProvider } from '@openzeppelin/defender-relay-client/lib/ethers';
// import { IDeployCampaignConfig } from "./campaign/types";
import { ZNSRegistry, ZNSRegistry__factory } from "../../typechain";
import { BaseContract, ContractFactory } from "ethers";

// const logger = getLogger();

const runCampaign = async () => {

  // doesn't return ContractFactory<any[], BaseContract> ?
  const factory = await ethers.getContractFactory("ZNSRegistry");
  
  // OZ tutorial for deployment
  // https://docs.openzeppelin.com/defender/v2/tutorial/deploy#deploy
  const upgradeApprovalProcess = await defender.getUpgradeApprovalProcess();

  // if (!upgradeApprovalProcess) {
  //   throw new Error("No upgrade approval process found");
  // }

  // // console.log(defender);
  // const deployTx = await defender.deployProxy(factory as unknown as ContractFactory<any[], BaseContract>, [ ethers.constants.AddressZero, upgradeApprovalProcess.address ],  { initializer: "initialize" });

  // const registry = await deployTx.deployed() as ZNSRegistry;

  // console.log(registry);

  // console.log(deployment);
  
  // .deployProxy(Box, [5, upgradeApprovalProcess.address], { initializer: "initialize" });

  // const provider = new DefenderRelayProvider(credentials);
  // const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });

  // const factory = await hre.ethers.getContractFactory("ZNSRegistry", signer);

  // const deployTx = await hre.upgrades.deployProxy(
  //   factory,
  //   [ mockAccessController.address ],
  //   {
  //     kind: "uups",
  //   }
  // );
  
  // const registry = await deployTx.deployed() as ZNSRegistry;

  // console.log(registry.address)
  // Reading `ENV_LEVEL` environment variable to determine rules to be enforced
  // const myThing : IDeployCampaignConfig = await getConfig({
  //   deployAdmin: signer,
  //   governors: [await signer.getAddress()],
  //   admins: [await signer.getAddress()]
  // });

  // await runZnsCampaign({
  //   config: myThing,
  //   provider: provider,
  // });
};

runCampaign().catch(error => {
  console.log(error.message);
});
