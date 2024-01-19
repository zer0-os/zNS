import { ProxyKinds } from "../../constants";
import {
  BaseDeployMission, IContractState, IHardhatBase, IProviderBase, ISignerBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { znsNames } from "./names";


export class ZNSFixedPricerDM <
  H extends IHardhatBase,
  S extends ISignerBase,
  P extends IProviderBase,
  St extends IContractState,
> extends BaseDeployMission<H, S, P, St> {
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
