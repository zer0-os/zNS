import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";


export class ZNSCurvePricerDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.curvePricer.contract;
  instanceName = znsNames.curvePricer.instance;

  deployArgs () : TDeployArgs {
    const {
      config: {
        rootPriceConfig,
      },
    } = this.campaign;

    const {
      accessController,
      registry,
    } = this.campaign.state.contracts;

    return [ accessController.target.toString(), registry.target.toString(), rootPriceConfig ];
  }
}
