import { Contract } from "ethers";
import {
  TDeployArgs,
  IProxyData,
  IDeployMissionArgs,
} from "./types";
import { DeployCampaign } from "../campaign/deploy-campaign";
import { ContractV6, IDeployCampaignConfig, TLogger } from "../campaign/types";
import { IContractDbData } from "../db/types";
import { erc1967ProxyName, transparentProxyName } from "./contracts/names";
import { ProxyKinds } from "../constants";
import { ContractByName } from "@tenderly/hardhat-tenderly/dist/tenderly/types";


export class BaseDeployMission {
  contractName! : string;
  instanceName! : string;
  proxyData! : IProxyData;
  campaign : DeployCampaign;
  logger : TLogger;
  config : IDeployCampaignConfig;
  implAddress! : string | null;

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

  async saveToDB (contract : ContractV6) {
    this.logger.debug(`Writing ${this.contractName} to DB...`);

    this.implAddress = this.proxyData.isProxy
      ? await this.campaign.deployer.getProxyImplAddress(await contract.getAddress())
      : null;

    const contractDbDoc = await this.buildDbObject(contract, this.implAddress);

    return this.campaign.dbAdapter.writeContract(this.contractName, contractDbDoc);
  }

  async preDeploy () {
    return Promise.resolve();
  }

  async needsDeploy () {
    const dbContract = await this.getFromDB();

    if (!dbContract) {
      this.logger.info(`${this.contractName} not found in DB, proceeding to deploy...`);
    } else {
      this.logger.info(`${this.contractName} found in DB at ${dbContract.address}, no deployment needed.`);

      const contract = await this.campaign.deployer.getContractObject(
        this.contractName,
        dbContract.address,
      ) as Contract;

      // eslint-disable-next-line max-len
      this.logger.debug(`Updating ${this.contractName} in state from DB data with address ${await contract.getAddress()}`);

      this.campaign.updateStateContract(this.instanceName, this.contractName, contract);
    }

    return !dbContract;
  }

  async deployArgs () : Promise<TDeployArgs> {
    return [];
  }

  getArtifact () {
    return this.campaign.deployer.getContractArtifact(this.contractName);
  }

  async buildDbObject (
    hhContract : ContractV6,
    implAddress : string | null
  ) : Promise<Omit<IContractDbData, "version">> {
    const { abi, bytecode } = this.getArtifact();
    return {
      name: this.contractName,
      address: await hhContract.getAddress(),
      abi: JSON.stringify(abi),
      bytecode,
      implementation: implAddress,
    };
  }

  async deploy () {
    const deployArgs = await this.deployArgs();
    this.logger.info(`Deploying ${this.contractName} with arguments: ${deployArgs}`);

    let contract : ContractV6;
    if (this.proxyData.isProxy) {
      contract = await this.campaign.deployer.deployProxy({
        contractName: this.contractName,
        args: deployArgs,
        kind: this.proxyData.kind,
      });
    } else {
      contract = await this.campaign.deployer.deployContract(this.contractName, deployArgs);
    }

    await this.saveToDB(contract);

    this.campaign.updateStateContract(this.instanceName, this.contractName, contract);

    this.logger.info(`Deployment success for ${this.contractName} at ${await contract.getAddress()}`);
  }

  async needsPostDeploy () {
    return Promise.resolve(false);
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

  async verify () {
    this.logger.debug(`Verifying ${this.contractName} on Etherscan...`);
    const address = await this.campaign[this.instanceName].getAddress();

    const ctorArgs = !this.proxyData.isProxy ? await this.deployArgs() : undefined;

    await this.campaign.deployer.etherscanVerify({
      address,
      ctorArgs,
    });

    this.logger.debug(`Etherscan verification for ${this.contractName} finished successfully.`);
  }

  async getMonitoringData () : Promise<Array<ContractByName>> {
    const implName = this.contractName;
    let implAddress = await this.campaign[this.instanceName].getAddress();

    if (this.proxyData.isProxy) {
      const proxyName = this.proxyData.kind === ProxyKinds.uups ? erc1967ProxyName : transparentProxyName;
      const proxyAddress = await this.campaign[this.instanceName].getAddress();
      implAddress = this.implAddress || await this.campaign.deployer.getProxyImplAddress(proxyAddress);

      return [
        {
          name: proxyName,
          address: proxyAddress,
        },
        {
          name: implName,
          address: implAddress,
        },
      ];
    }

    return [
      {
        name: implName,
        address: implAddress,
      },
    ];
  }
}
