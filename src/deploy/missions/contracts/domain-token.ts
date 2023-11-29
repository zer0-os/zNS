import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";

export class ZNSDomainTokenDM extends BaseDeployMission {
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
