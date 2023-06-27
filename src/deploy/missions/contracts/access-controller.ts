import { BaseDeployMission } from "../base-deploy-mission";


class ZNSAccessControllerDM extends BaseDeployMission {
  proxyData = {
    isProxy: false,
  };
  // TODO dep: make constants available for both this and tests.
  //  possibly use ones from the helpers
  contractName = "ZNSAccessController";
  instanceName = "accessController";
  nameInDb = this.contractName;

  async postDeploy () {
    const {
      governorAddresses,
      adminAddresses,
    } = this.config;
    // TODO dep: make indexable proxy to pull these easily
    const accessController = this.campaign.state.contracts[this.instanceName];

    await accessController.initialize(governorAddresses, adminAddresses);
  }
}

export default ZNSAccessControllerDM;
