import { BaseDeployMission } from "../base-deploy-mission";
import { znsNames } from "../../constants";


export class ZNSAccessControllerDM extends BaseDeployMission {
  proxyData = {
    isProxy: false,
  };
  // TODO dep: make constants available for both this and tests.
  //  possibly use ones from the helpers
  contractName = znsNames.accessController.contract;
  instanceName = znsNames.accessController.instance;

  // TODO: remove this when initialize is removed from AccessController
  async postDeploy () {
    const {
      governorAddresses,
      adminAddresses,
    } = this.config;
    const { accessController } = this.campaign;

    await accessController.initialize(governorAddresses, adminAddresses);
  }
}
