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

  async needsPostDeploy () : Promise<boolean> {
    return this.config.mockMeowToken;
  }

  // this should launch ONLY if the Meow Token was mocked in test !
  async postDeploy () {
    const {
      meowToken,
      treasury,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    // Give allowance to the treasury
    await meowToken.connect(deployAdmin).approve(
      treasury.address,
      ethers.constants.MaxUint256
    );
  }
}
