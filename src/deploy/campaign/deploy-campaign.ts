import { toCampaignProxy } from "./campaign-proxy";
import { ICampaignArgs, ICampaignState } from "./types";
import { Deployer } from "../deployer/deployer";
import { DeployMissionCtor } from "../missions/types";
import { BaseDeployMission } from "../missions/base-deploy-mission";
import { Contract } from "ethers";


export class DeployCampaign {
  state : ICampaignState;
  deployer : Deployer;
  // TODO dep: fix typing
  dbAdapter : object;
  logger : Console;
  opts : object;

  constructor ({
    missions,
    deployer,
    dbAdapter,
    logger,
    opts,
  } : ICampaignArgs) {
    this.state = {
      missions,
      instances: [],
      contracts: {},
    };
    this.deployer = deployer;
    this.dbAdapter = dbAdapter;
    this.logger = logger;
    this.opts = opts;

    // instantiate all missions
    this.state.instances = missions.map(
      (mission : DeployMissionCtor) => new mission({
        campaign: this,
        logger,
        opts,
      })
    );

    // const campaignProxy = toCampaignProxy(this);

    this.logger.debug("DeployCampaign initialized.");

    // return campaignProxy;
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
    this.logger.debug(`Updated instance ${instanceName} in Campaign State to ${contract}.`);
  }
}