import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


export class ZNSPriceOracleDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.priceOracle.contract;
  instanceName = znsNames.priceOracle.instance;

  deployArgs () : TDeployArgs {
    const {
      accessController,
      config: {
        priceConfig,
        registrationFee,
      },
    } = this.campaign;

    return [ accessController.address, priceConfig, registrationFee ];
  }
}
