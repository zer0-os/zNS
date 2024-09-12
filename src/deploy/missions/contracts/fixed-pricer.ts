import { ProxyKinds } from "../../constants";
import {
  BaseUpgradeMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { znsNames } from "./names";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSFixedPricerDM extends BaseUpgradeMission<
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
