import { Contract } from "ethers";
import { IContractDbObject, IProxyData } from "./types";
import { DeployCampaign } from "../campaign/deploy-campaign";


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
  opts : object;

  constructor ({
    campaign,
    logger,
    opts,
    // TODO dep: refine typing
  } : {
    campaign : DeployCampaign;
    logger : Console;
    opts : object;
  }) {
    this.campaign = campaign;
    this.logger = logger;
    this.opts = opts;
  }

  async getFromDB () {
    // TODO dep: implement
    // return this.campaign.dbAdapter.getContractInstance(this.nameInDb);
    return Promise.resolve({});
  }

  async pushToDB (dbContractObj : IContractDbObject) {
    // TODO dep: implement
    // return this.campaign.dbAdapter.writeContract(this.nameInDb, dbContractObj);
  }

  async preDeploy () {
    return Promise.resolve();
  }

  async shouldDeploy () {
    const dbContract = await this.getFromDB();
    return !dbContract;
  }

  deployArgs () {
    this.logger.info(`Deploying ${this.contractName} with args: []`);
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
    const shouldDeploy = await this.shouldDeploy();
    if (shouldDeploy) {
      this.logger.info(`Deploying ${this.contractName}...`);

      // TODO dep: is this in the right spot?
      await this.preDeploy();

      const deployArgs = this.deployArgs();

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

      this.logger.info(`Deployed ${this.contractName} at ${contract.address}`);

      await this.postDeploy();
    }
  }

  async shouldPostDeploy () {
    return Promise.resolve(true);
  }

  async postDeploy () {
    return Promise.resolve();
  }

  async execute () {
    if (await this.shouldDeploy()) {
      await this.deploy();
    } else {
      this.logger.info(`Skipping ${this.contractName} deployment...`);
    }

    if (await this.shouldPostDeploy()) {
      await this.postDeploy();
    }
  }
}
