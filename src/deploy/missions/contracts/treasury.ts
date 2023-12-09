import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";


export class ZNSTreasuryDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.treasury.contract;
  instanceName = znsNames.treasury.instance;

  deployArgs () : TDeployArgs {
    const {
      accessController,
      registry,
      meowToken,
      config: {
        zeroVaultAddress,
      },
    } = this.campaign;

    const accessControllerAddress = this.campaign.state.contracts.accessController.target.toString();
    const registryAddress = this.campaign.state.contracts.registry.target.toString();
    const meowTokenAddress = this.campaign.state.contracts.meowToken.target.toString();

    return [
      accessControllerAddress,
      registryAddress,
      meowTokenAddress,
      zeroVaultAddress,
    ];
  }
}
