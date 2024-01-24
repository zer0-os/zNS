import {
  BaseDeployMission,
  IContractState,
  IHardhatBase,
  IProviderBase,
  ISignerBase, TDeployArgs,
} from "@zero-tech/zdc";
import { znsNames } from "./names";


export class ZNSAccessControllerDM <
  H extends IHardhatBase,
  S extends ISignerBase,
  P extends IProviderBase,
  St extends IContractState,
> extends BaseDeployMission<H, S, P, St> {
  proxyData = {
    isProxy: false,
  };

  contractName = znsNames.accessController.contract;
  instanceName = znsNames.accessController.instance;

  async deployArgs () {
    const {
      governorAddresses,
      adminAddresses,
    } = this.config;

    return [ governorAddresses, adminAddresses ];
  }
}
