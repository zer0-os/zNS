import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds } from "../../constants";
import { TDeployArgs } from "../types";


class ZNSRegistryDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = "ZNSRegistry";
  instanceName = "registry";
  // TODO dep: figure out the naming here
  nameInDb = this.contractName;

  deployArgs () : TDeployArgs {
    const accessController = this.campaign.state.contracts.accessController.address;
    return [ accessController ];
  }
}

export default ZNSRegistryDM;
