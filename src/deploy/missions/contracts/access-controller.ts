import { BaseDeployMission, IHardhatBase, IProviderBase, ISignerBase } from "@zero-tech/zdc";

import { znsNames } from "./names";


export class ZNSAccessControllerDM <
  H extends IHardhatBase,
  S extends ISignerBase,
  P extends IProviderBase,
> extends BaseDeployMission<H, S, P> {
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
