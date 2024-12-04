import {
  BaseDeployMission,
} from "@zero-tech/zdc";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZNSCampaignConfig, IZNSContracts, IZNSSigner } from "../../../campaign/types";


export class ZNSAccessControllerDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
IZNSSigner,
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
