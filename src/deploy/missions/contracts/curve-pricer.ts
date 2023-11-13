import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


export class ZNSCurvePricerDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.curvePricer.contract;
  instanceName = znsNames.curvePricer.instance;

  deployArgs () : TDeployArgs {
    const {
      accessController,
      registry,
      config: {
        rootPriceConfig,
      },
    } = this.campaign;

    return [ accessController.address, registry.address, rootPriceConfig ];
  }
}
