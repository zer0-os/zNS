import { BaseDeployMission } from "../base-deploy-mission";

export class AccessControllerDM extends BaseDeployMission {
  proxyData = {
    isProxy: false,
  };
  // TODO dep: make constants available for both this and tests.
  //  possibly use ones from the helpers
  contractName = "ZNSAccessController";
  instanceName = "accessController";

  async postDeploy () {
    const {
      governorAddresses,
      adminAddresses,
    } = this.config;
    // TODO dep: make indexable proxy to pull these easily
    const accessController = this.campaign.state.contracts[this.instanceName];

    await accessController.initialize(governorAddresses, adminAddresses);
  }

  async needsDeploy () {
    // TODO dep: fix this when DB adapter is implemented
    //  this is temporary!
    return Promise.resolve(true);
  }
}
