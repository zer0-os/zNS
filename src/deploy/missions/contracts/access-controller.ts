import {
  BaseDeployMission,
} from "@zero-tech/zdc";
import { znsNames } from "./names";
import { IZNSContracts, IZNSCampaignConfig } from "../../campaign/types";


export class ZNSAccessControllerDM extends BaseDeployMission<
IZNSCampaignConfig,
IZNSContracts
> {
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

    return [governorAddresses, adminAddresses];
  }
}
