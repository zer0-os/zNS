import { BaseDeployMission } from "../base-deploy-mission";

import { znsNames } from "./names";


export class ZNSAccessControllerDM extends BaseDeployMission {
  proxyData = {
    isProxy: false,
  };
  // TODO dep: make constants available for both this and tests.
  //  possibly use ones from the helpers
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
