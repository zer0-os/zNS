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
    // TODO dep: refine typing
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
    // TODO dep: implement
    // return this.campaign.dbAdapter.getContractInstance(this.nameInDb);
    // TODO dep: change this from undefined
    return Promise.resolve(undefined);
  }

  async pushToDB (dbContractObj : IContractDbObject) {
    // TODO dep: implement
    // return this.campaign.dbAdapter.writeContract(this.nameInDb, dbContractObj);
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

  buildDbObject (hhContract : Contract) : IContractDbObject {
    // TODO dep: refine this
    //  - add versioning for each contract (based on date in unix or pkg?)
    return {
      address: hhContract.address,
      abi: JSON.stringify(hhContract.abi),
      bytecode: hhContract.bytecode,
      args: JSON.stringify(this.deployArgs()),
      date: new Date().toString(),
    };
  }

  async deploy () {
    // TODO dep: is this in the right spot?
    await this.preDeploy();

    const deployArgs = this.deployArgs();
    this.logger.info(`Deploying ${this.contractName} with arguments: ${JSON.stringify(deployArgs)}`);

    let contract;
    if (this.proxyData.isProxy) {
      contract = await this.campaign.deployer.deployProxy({
        contractName: this.contractName,
        args: deployArgs,
        kind: this.proxyData.proxyKind,
      });
    } else if (!this.proxyData.isProxy) {
      contract = await this.campaign.deployer.deployContract(this.contractName, deployArgs);
    } else {
      // TODO dep: can this even hit? verify!
      throw new Error("Invalid proxy data specified in the contract's mission");
    }

    const dbObj = this.buildDbObject(contract);

    await this.pushToDB(dbObj);

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
      await this.deploy();
    } else {
      this.logger.info(`Skipping ${this.contractName} deployment...`);
    }

    if (await this.needsPostDeploy()) {
      await this.postDeploy();
    }
  }
}
