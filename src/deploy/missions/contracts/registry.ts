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
    const { accessController: { address: acAddress } } = this.campaign;
    return [ acAddress ];
  }
}

export default ZNSRegistryDM;
