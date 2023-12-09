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

  deployArgs () : TDeployArgs {
    const acAddress = this.campaign.state.contracts.accessController.target.toString();

    const {
      domainToken: {
        name,
        symbol,
        defaultRoyaltyReceiver,
        defaultRoyaltyFraction,
      },
    } = this.config;

    return [ acAddress, name, symbol, defaultRoyaltyReceiver, defaultRoyaltyFraction ];
  }
}
