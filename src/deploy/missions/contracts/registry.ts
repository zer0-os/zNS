import {
  BaseDeployMission,
  IHardhatBase,
  IProviderBase,
  ISignerBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";


export class ZNSRegistryDM <
  H extends IHardhatBase,
  S extends ISignerBase,
  P extends IProviderBase,
> extends BaseDeployMission<H, S, P> {
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
