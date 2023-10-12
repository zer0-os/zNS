import { BigNumber, Contract } from "ethers";
import {
  TDeployArgs,
  IContractDbObject,
  IProxyData,
  IDeployMissionArgs,
  TDeployArg,
} from "./types";
import { DeployCampaign } from "../campaign/deploy-campaign";
import { IDeployCampaignConfig, TLogger } from "../campaign/types";


// TODO dep:
//    1. add better logging for each step
//    2. add proper error handling
export class BaseDeployMission {
  contractName! : string;
  instanceName! : string;
  proxyData! : IProxyData;
  campaign : DeployCampaign;
  logger : TLogger;
  config : IDeployCampaignConfig;

  constructor ({
    campaign,
    logger,
    config,
  } : IDeployMissionArgs) {
    this.campaign = campaign;
    this.logger = logger;
    this.config = config;
  }

  async getFromDB () {
    return this.campaign.dbAdapter.getContract(this.contractName);
  }

  async saveToDB (contract : Contract) {
    this.logger.debug(`Writing ${this.contractName} to DB...`);

    const implAddress = this.proxyData.isProxy
      ? await this.campaign.deployer.getProxyImplAddress(contract.address)
      : null;

    const contractDbDoc = this.buildDbObject(contract, implAddress);

    return this.campaign.dbAdapter.writeContract(this.contractName, contractDbDoc);
  }

  async preDeploy () {
    return Promise.resolve();
  }

  async needsDeploy () {
    const dbContract = await this.getFromDB();

    // TODO dep: refine these
    if (!dbContract) {
      this.logger.debug(`${this.contractName} not found in DB, proceeding to deploy...`);
    } else {
      this.logger.debug(`${this.contractName} found in DB at ${dbContract.address}, no deployment needed.`);
    }

    return !dbContract;
  }

  deployArgs () : TDeployArgs {
    return [];
  }

  getArtifact () {
    return this.campaign.deployer.getContractArtifact(this.contractName);
  }

  buildDbObject (hhContract : Contract, implAddress : string | null) : IContractDbObject {
    const { abi, bytecode } = this.getArtifact();
    return {
      address: hhContract.address,
      abi: JSON.stringify(abi),
      bytecode,
      args: JSON.stringify(this.deployArgs()),
      implementation: implAddress,
      version: this.campaign.version,
    };
  }

  async deploy () {
    const deployArgs = this.deployArgs();
    this.logger.info(`Deploying ${this.contractName} with arguments: ${this.deployArgs()}`);

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

    await this.saveToDB(contract);

    this.campaign.updateStateContract(this.instanceName, this.contractName, contract);

    this.logger.info(`Deployment success for ${this.contractName} at ${contract.address}`);
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
