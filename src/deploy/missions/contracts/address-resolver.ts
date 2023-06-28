import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


class AddressResolverDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.addressResolver.contract;
  instanceName = znsNames.addressResolver.instance;

  deployArgs () : TDeployArgs {
    const { accessController, registry } = this.campaign;

    return [ accessController.address, registry.address ];
  }
}

export default AddressResolverDM;
