import {
  BaseUpgradeMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSTreasuryDM extends BaseUpgradeMission<
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.treasury.contract;
  instanceName = znsNames.treasury.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      meowToken,
      config: {
        zeroVaultAddress,
      },
    } = this.campaign;

    return [
      await accessController.getAddress(),
      await registry.getAddress(),
      await meowToken.getAddress(),
      zeroVaultAddress,
    ];
  }
}
