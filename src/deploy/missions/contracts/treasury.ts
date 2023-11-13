import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds } from "../../constants";
import { IDeployMissionArgs, TDeployArgs } from "../types";
import { ethers } from "ethers";
import { MeowTokenDM } from "./meow-token/meow-token";
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

    return [
      accessController.address,
      registry.address,
      meowToken.address,
      zeroVaultAddress,
    ];
  }
}
