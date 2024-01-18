import {
  BaseDeployMission,
  TDeployArgs,
  IHardhatBase,
  IProviderBase,
  ISignerBase,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";


export class ZNSCurvePricerDM <
  H extends IHardhatBase,
  S extends ISignerBase,
  P extends IProviderBase,
> extends BaseDeployMission<H, S, P> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.curvePricer.contract;
  instanceName = znsNames.curvePricer.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      config: {
        rootPriceConfig,
      },
    } = this.campaign;

    return [await accessController.getAddress(), await registry.getAddress(), rootPriceConfig];
  }
}
