import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { IDeployMissionArgs, TDeployArgs } from "../types";
import { ethers } from "ethers";
import { MeowTokenMockDM } from "./mocks/meow-token-mock";


export class ZNSTreasuryDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  // bool for determining token setup behaviour
  // determined in constructor
  isMockedMeowToken : boolean;
  contractName = znsNames.treasury.contract;
  instanceName = znsNames.treasury.instance;

  constructor (args : IDeployMissionArgs) {
    super(args);

    const {
      config: {
        stakingTokenAddress,
      },
    } = this.campaign;

    if (!!stakingTokenAddress) {
      this.isMockedMeowToken = false;
    } else {
      // TODO dep: is this a correct check?
      if (!this.campaign.state.missions.includes(MeowTokenMockDM)) throw new Error(
        `No staking token found!
        Please make sure to provide 'stakingTokenAddress' to the config
        or add mocked token to the Deploy Campaign if this is a test.`
      );

      this.isMockedMeowToken = true;
    }
  }

  deployArgs () : TDeployArgs {
    const {
      accessController,
      registry,
      meowToken,
      config: {
        stakingTokenAddress,
        zeroVaultAddress,
      },
    } = this.campaign;

    const stakingToken = !this.isMockedMeowToken
      ? stakingTokenAddress
      : meowToken.address;

    return [
      accessController.address,
      registry.address,
      stakingToken,
      zeroVaultAddress,
    ];
  }

  async needsPostDeploy () : Promise<boolean> {
    return this.isMockedMeowToken;
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
