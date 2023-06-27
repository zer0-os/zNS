import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds } from "../../constants";
import { TDeployArgs } from "../types";

export class ZNSRegistryDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = "ZNSRegistry";
  instanceName = "registry";

  deployArgs () : TDeployArgs {
    const accessController = this.campaign.state.contracts.accessController.address;
    return [ accessController ];
  }
}
