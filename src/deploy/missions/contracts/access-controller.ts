import { BaseDeployMission } from "../base-deploy-mission";

import { znsNames } from "./names";


export class ZNSAccessControllerDM extends BaseDeployMission {
  proxyData = {
    isProxy: false,
  };

  contractName = znsNames.accessController.contract;
  instanceName = znsNames.accessController.instance;

  deployArgs () {
    const {
      governorAddresses,
      adminAddresses,
    } = this.config;

    return [ governorAddresses, adminAddresses ];
  }
}
