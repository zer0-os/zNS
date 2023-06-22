import { DeployCampaign } from "./deploy-campaign";

export const toCampaignProxy = object => new Proxy(
  object,
  {
    get: (target : any, p : string) : keyof DeployCampaign => {
      if (target.state.instances[p]) {
        return target.state.instances[p];
      }
      return target[p];
    },
  }
);
