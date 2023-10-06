import { ICampaignArgs, ICampaignState, IDeployCampaignConfig, Logger } from "./types";
import { HardhatDeployer } from "../deployer/hardhat-deployer";
import { TDeployMissionCtor } from "../missions/types";
import { BaseDeployMission } from "../missions/base-deploy-mission";
import { Contract } from "ethers";
import { BaseStorageAdapter } from "../storage/base-storage-adapter";


export class DeployCampaign {
  state : ICampaignState;
  deployer : HardhatDeployer;
  dbAdapter : BaseStorageAdapter;
  logger : Logger;
  config : IDeployCampaignConfig;
  version : string;

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
      instances: [],
      contracts: {},
    };
    this.deployer = deployer;
    this.dbAdapter = dbAdapter;
    this.logger = logger;
    this.config = config;
    this.version = Date.now().toString();

    const campaignProxy = new Proxy(this, DeployCampaign.indexedHandler);

    // instantiate all missions
    this.state.instances = missions.map(
      (mission : TDeployMissionCtor) => new mission({
        campaign: campaignProxy,
        logger,
        config,
      })
    );

    this.logger.debug("Deploy Campaign initialized.");

    return campaignProxy;
  }

  async execute () {
    return this.state.instances.reduce(
      async (
        acc : Promise<void>,
        mission : BaseDeployMission,
      ) : Promise<void> => {
        await acc;
        return mission.execute();
      },
      Promise.resolve()
    );
  }

  updateStateContract (instanceName : string, contract : Contract) {
    this.state.contracts[instanceName] = contract;
    // TODO dep: make better logger and decide which levels to call where
    this.logger.debug(`Data of deployed contract '${instanceName}' is added to Campaign state.`);
  }
}