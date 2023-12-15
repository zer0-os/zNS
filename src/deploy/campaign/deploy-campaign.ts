import {
  ICampaignArgs,
  ICampaignState,
  IDeployCampaignConfig,
  TLogger,
  IMissionInstances,
  TZNSContractState,
  ContractV6,
} from "./types";
import { HardhatDeployer } from "../deployer/hardhat-deployer";
import { ITenderlyContractData, TDeployMissionCtor } from "../missions/types";
import { BaseDeployMission } from "../missions/base-deploy-mission";
import { MongoDBAdapter } from "../db/mongo-adapter/mongo-adapter";


export class DeployCampaign {
  state : ICampaignState;
  deployer : HardhatDeployer;
  dbAdapter : MongoDBAdapter;
  logger : TLogger;
  config : IDeployCampaignConfig;

  // TODO dep: improve typing here so that methods of each contract type are resolved in Mission classes!
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

    this.logger.info("Deploy Campaign initialized.");

    return campaignProxy;
  }

  async execute () {
    this.logger.info("Deploy Campaign execution started.");

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

    this.logger.info("Deploy Campaign execution finished successfully.");
  }

  updateStateContract (instanceName : string, contractName : string, contract : ContractV6) {
    this.state.contracts[instanceName] = contract;
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
        acc : Promise<Array<ITenderlyContractData>>,
        missionInstance : BaseDeployMission,
      ) : Promise<Array<ITenderlyContractData>> => {
        const newAcc = await acc;
        const data = await missionInstance.getMonitoringData();

        return [...newAcc, ...data];
      },
      Promise.resolve([])
    );

    const response = await this.deployer.tenderlyPush(contracts);

    this.logger.info(`
    Tenderly push finished successfully for Project ${this.config.postDeploy.tenderlyProjectSlug}
    with data: ${JSON.stringify(response, null, "\t")}
    `);
  }
}
