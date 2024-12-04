import { ProxyKinds } from "../../../constants";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZNSCampaignConfig, IZNSContracts, IZNSSigner } from "../../../campaign/types";

export class ZNSFixedPricerDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
IZNSSigner,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.fixedPricer.contract;
  instanceName = znsNames.fixedPricer.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
    } = this.campaign;

    return [await accessController.getAddress(), await registry.getAddress()];
  }
}
