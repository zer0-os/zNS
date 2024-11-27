import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../../constants";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZNSCampaignConfig, IZNSContracts, IZNSSigner } from "../../../campaign/types";


export class ZNSRegistryDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
IZNSSigner,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.registry.contract;
  instanceName = znsNames.registry.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const { accessController } = this.campaign;
    return [ await accessController.getAddress() ];
  }
}
