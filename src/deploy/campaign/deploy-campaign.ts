import {
  ICampaignArgs,
  ICampaignState,
  IDeployCampaignConfig,
  TLogger,
  IMissionInstances,
  TZNSContractState,
} from "./types";
import { HardhatDeployer } from "../deployer/hardhat-deployer";
import { TDeployMissionCtor } from "../missions/types";
import { BaseDeployMission } from "../missions/base-deploy-mission";
import { Contract } from "ethers";
import { MongoDBAdapter } from "../db/mongo-adapter/mongo-adapter";
import { ContractByName } from "@tenderly/hardhat-tenderly/dist/tenderly/types";


export class DeployCampaign {
  state : ICampaignState;
  deployer : HardhatDeployer;
  dbAdapter : MongoDBAdapter;
  logger : TLogger;
  config : IDeployCampaignConfig;
  version : string;

  // TODO dep: figure out typing here so that methods of each contract type are resolved in Mission classes!
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name : string | symbol] : any;

  private static indexedHandler : ProxyHandler<DeployCampaign> = {
    get: (target, prop) => {
      if (typeof prop === "string") {
        if (!!target.state.contracts[prop]) {
          return target.state.contracts[prop];
        }

        if (!!target[prop]) {
          return target[prop];
        }
      }
    },
  };

  constructor ({
    missions,
    deployer,
    dbAdapter,
    logger,
    config,
  } : ICampaignArgs) {
    this.state = {
      missions,
      instances: {},
      contracts: {} as TZNSContractState,
    };
    this.deployer = deployer;
    this.dbAdapter = dbAdapter;
    this.logger = logger;
    this.config = config;
    this.version = Date.now().toString();

    const campaignProxy = new Proxy(this, DeployCampaign.indexedHandler);

    // instantiate all missions
    this.state.instances = missions.reduce(
      (acc : IMissionInstances, mission : TDeployMissionCtor) => {
        const instance = new mission({
          campaign: campaignProxy,
          logger,
          config,
        });

        acc[instance.instanceName] = instance;
        return acc;
      },
      {}
    );

    this.logger.debug("Deploy Campaign initialized.");

    return campaignProxy;
  }

  async execute () {
    this.logger.debug("Deploy Campaign execution started.");

    await Object.values(this.state.instances).reduce(
      async (
        acc : Promise<void>,
        missionInstance : BaseDeployMission,
      ) : Promise<void> => {
        await acc;
        return missionInstance.execute();
      },
      Promise.resolve()
    );

    if (this.config.postDeploy.verifyContracts) {
      await this.verify();
    }

    if (this.config.postDeploy.monitorContracts) {
      await this.monitor();
    }

    this.logger.debug("Deploy Campaign execution finished successfully.");
  }

  updateStateContract (instanceName : string, contractName : string, contract : Contract) {
    this.state.contracts[instanceName] = contract;
    // TODO dep: make better logger and decide which levels to call where
    this.logger.debug(`Data of deployed contract '${contractName}' is added to Campaign state at '${instanceName}'.`);
  }

  async verify () {
    return Object.values(this.state.instances).reduce(
      async (
        acc : Promise<void>,
        missionInstance : BaseDeployMission,
      ) => {
        await acc;
        return missionInstance.verify();
      },
      Promise.resolve()
    );
  }

  async monitor () {
    this.logger.info("Pushing contracts to Tenderly...");

    const contracts = await Object.values(this.state.instances).reduce(
      async (
        acc : Promise<Array<ContractByName>>,
        missionInstance : BaseDeployMission,
      ) : Promise<Array<ContractByName>> => {
        const newAcc = await acc;
        const data = await missionInstance.getMonitoringData();

        return [...newAcc, ...data];
      },
      Promise.resolve([])
    );

    await this.deployer.tenderlyVerify(contracts);

    this.logger.info(`Tenderly push finished successfully for Project ${this.config.postDeploy.tenderlyProjectSlug}.`);
  }
}
