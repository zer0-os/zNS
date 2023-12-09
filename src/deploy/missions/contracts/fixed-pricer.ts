import { ProxyKinds } from "../../constants";
import { TDeployArgs } from "../types";
import { BaseDeployMission } from "../base-deploy-mission";
import { znsNames } from "./names";


export class ZNSFixedPricerDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.fixedPricer.contract;
  instanceName = znsNames.fixedPricer.instance;

  deployArgs () : TDeployArgs {
    const accessControllerAddress = this.campaign.state.contracts.accessController.target;
    const registryAddress = this.campaign.state.contracts.registry.target;

    return [ accessControllerAddress.toString(), registryAddress.toString() ];
  }
}
