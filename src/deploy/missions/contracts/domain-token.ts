import {
  BaseDeployMission,
  IContractState,
  IHardhatBase,
  IProviderBase,
  ISignerBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";


export class ZNSDomainTokenDM <
  H extends IHardhatBase,
  S extends ISignerBase,
  P extends IProviderBase,
  St extends IContractState,
> extends BaseDeployMission<H, S, P, St> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.domainToken.contract;
  instanceName = znsNames.domainToken.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const { accessController } = this.campaign;
    const {
      domainToken: {
        name,
        symbol,
        defaultRoyaltyReceiver,
        defaultRoyaltyFraction,
      },
    } = this.config;

    return [ await accessController.getAddress(), name, symbol, defaultRoyaltyReceiver, defaultRoyaltyFraction ];
  }
}
