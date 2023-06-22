import { DeployCampaign } from "./deploy-campaign";


// TODO dep: make better proxy handler, possibly in the class itself
export const toCampaignProxy = (object : DeployCampaign) => new Proxy(
  object,
  {
    // TODO dep: make better typing for this
    get: (target : DeployCampaign, p : string) : unknown => {
      if (target.state.contracts[p]) {
        return target.state.contracts[p];
      }
      // return target[p];
    },
  }
);
