import { toCampaignProxy } from "./campaign-proxy";
import { MissionInstance } from "./types";


export class DeployCampaign {
  state : any;
  dbAdapter : any;
  logger : any;
  opts : any;

  constructor ({
    missions,
    dbAdapter,
    logger,
    opts,
  }) {
    this.state = {
      missions,
      instances: {},
    };
    this.dbAdapter = dbAdapter;
    this.logger = logger;

    // instantiate all missions and write into the campaign state
    this.state.instances = missions.reduce(
      (acc, mission) => {
        const newInstance = new mission();
        const name = newInstance.instanceName;
        newInstance.campaign = this;
        acc[name] = newInstance;
        return acc;
      }, {}
    );

    const campaignAccessor = toCampaignProxy(this);

    this.logger.debug("DeployCampaign initialized.");

    return campaignAccessor;
  }

  execute () {
    return this.state.instances.reduce(
      async (
        acc : Promise<void>,
        mission : MissionInstance,
      ) : Promise<void> => {
        await acc;
        return mission.execute();
      },
      Promise.resolve()
    );
  }

  updateStateInstance (instanceName : string, instance : MissionInstance) {
    this.state.instances[instanceName] = instance;
    this.logger.debug(`Updated instance ${instanceName} in Campaign State to ${instance}.`);
  }
}