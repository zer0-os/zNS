import { ICampaignArgs, ICampaignState, IDeployCampaignConfig } from "./types";
import { Deployer } from "../deployer/deployer";
import { TDeployMissionCtor } from "../missions/types";
import { BaseDeployMission } from "../missions/base-deploy-mission";
import { Contract } from "ethers";
import { BaseStorageAdapter } from "../storage/base-storage-adapter";


export class DeployCampaign {
  state : ICampaignState;
  deployer : Deployer;
  // TODO dep: fix typing
  dbAdapter : BaseStorageAdapter;
  logger : Console;
  config : IDeployCampaignConfig;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name : string | symbol] : any;

  private static indexedHandler : ProxyHandler<DeployCampaign> = {
    get: (target, prop) => {
      if (typeof prop === "string" && !!target.state.contracts[prop]) {
        return target.state.contracts[prop];
      } else if (typeof prop === "string") {
        return target[prop];
      }

      throw new Error(`
      Accessing deployed contract data that is not in Campaign State or
      property '${prop.toString()}' does not exist on DeployCampaign.
      `);
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

    const campaignProxy = new Proxy(this, DeployCampaign.indexedHandler);

    // instantiate all missions
    this.state.instances = missions.map(
      (mission : TDeployMissionCtor) => new mission({
        campaign: campaignProxy,
        logger,
        config,
      })
    );

    this.logger.debug("DeployCampaign initialized.");

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
    this.logger.debug(`Instance of deployed contract '${instanceName}' is added to Campaign state.`);
  }
}
