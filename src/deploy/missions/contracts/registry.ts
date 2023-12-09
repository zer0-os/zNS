import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";


export class ZNSRegistryDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.registry.contract;
  instanceName = znsNames.registry.instance;

  deployArgs () : TDeployArgs {
    return [ this.campaign.state.contracts.accessController.target.toString() ];
  }
}
