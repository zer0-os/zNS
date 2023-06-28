import { Contract } from "ethers";
import { TDeployArgs, IContractDbObject, IProxyData } from "./types";
import { DeployCampaign } from "../campaign/deploy-campaign";
import { IDeployCampaignConfig } from "../campaign/types";


// TODO dep:
//    1. add better logging for each step
//    2. add proper error handling
export class BaseDeployMission {
  nameInDb! : string;
  contractName! : string;
  instanceName! : string;
  proxyData! : IProxyData;
  campaign : DeployCampaign;
  logger : Console;
  config : IDeployCampaignConfig;

  constructor ({
    campaign,
    logger,
    config,
  } : {
    campaign : DeployCampaign;
    logger : Console;
    config : IDeployCampaignConfig;
  }) {
    this.campaign = campaign;
    this.logger = logger;
    this.config = config;
  }

  async getFromDB () {
    return this.campaign.dbAdapter.getContract(this.nameInDb);
  }

  async pushToDB (contract : Contract) {
    const contractDbDoc = this.buildDbObject(contract);
    return this.campaign.dbAdapter.writeContract(this.nameInDb, contractDbDoc);
  }

  async preDeploy () {
    return Promise.resolve();
  }

  async needsDeploy () {
    const dbContract = await this.getFromDB();
    return !dbContract;
  }

  deployArgs () : TDeployArgs {
    return [];
  }

  getArtifact () {
    return this.campaign.deployer.getContractArtifact(this.contractName);
  }

  buildDbObject (hhContract : Contract) : IContractDbObject {
    const { abi, bytecode } = this.getArtifact();
    return {
      address: hhContract.address,
      abi: JSON.stringify(abi),
      bytecode,
      args: JSON.stringify(this.deployArgs()),
      version: this.campaign.version,
    };
  }

  async deploy () {
    const deployArgs = this.deployArgs();
    this.logger.info(`Deploying ${this.contractName} with arguments: ${JSON.stringify(deployArgs)}`);

    let contract;
    if (this.proxyData.isProxy) {
      contract = await this.campaign.deployer.deployProxy({
        contractName: this.contractName,
        args: deployArgs,
        kind: this.proxyData.proxyKind,
      });
    } else {
      contract = await this.campaign.deployer.deployContract(this.contractName, deployArgs);
    }

    await this.pushToDB(contract);

    await this.campaign.updateStateContract(this.instanceName, contract);

    this.logger.info(`Deploy success for ${this.contractName} at ${contract.address}`);
  }

  async needsPostDeploy () {
    return Promise.resolve(true);
  }

  async postDeploy () {
    return Promise.resolve();
  }

  async execute () {
    if (await this.needsDeploy()) {
      await this.preDeploy();
      await this.deploy();
    } else {
      this.logger.info(`Skipping ${this.contractName} deployment...`);
    }

    if (await this.needsPostDeploy()) {
      await this.postDeploy();
    }
  }
}
