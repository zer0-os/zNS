import {
  BaseDeployMission, IContractState,
  IHardhatBase,
  IProviderBase,
  ISignerBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";


export class ZNSTreasuryDM <
  H extends IHardhatBase,
  S extends ISignerBase,
  P extends IProviderBase,
  St extends IContractState,
> extends BaseDeployMission<H, S, P, St> {
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
