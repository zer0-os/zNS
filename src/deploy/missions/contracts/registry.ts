import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


export class ZNSRegistryDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.registry.contract;
  instanceName = znsNames.registry.instance;

  deployArgs () : TDeployArgs {
    const { accessController: { address: acAddress } } = this.campaign;
    return [ acAddress ];
  }
}
