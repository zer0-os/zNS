import {
  BaseUpgradeMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSRegistryDM extends BaseUpgradeMission<
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
