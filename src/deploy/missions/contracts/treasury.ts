import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { IDeployMissionArgs, TDeployArgs } from "../types";
import { ethers } from "ethers";
import ZeroTokenMockDM from "./mocks/zero-token-mock";


class ZNSTreasuryDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  // bool for determining token setup behaviour
  // determined in constructor
  isMockedZeroToken : boolean;
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
      this.isMockedZeroToken = false;
    } else {
      // TODO dep: is this a correct check?
      if (!this.campaign.state.missions.includes(ZeroTokenMockDM)) throw new Error(
        `No staking token found!
        Please make sure to provide 'stakingTokenAddress' to the config
        or add mocked token to the Deploy Campaign if this is a test.`
      );

      this.isMockedZeroToken = true;
    }
  }

  deployArgs () : TDeployArgs {
    const {
      accessController,
      priceOracle,
      zeroToken,
      config: {
        stakingTokenAddress,
        zeroVaultAddress,
      },
    } = this.campaign;

    const stakingToken = !this.isMockedZeroToken
      ? stakingTokenAddress
      : zeroToken.address;

    return [
      accessController.address,
      priceOracle.address,
      stakingToken,
      zeroVaultAddress,
    ];
  }

  async needsPostDeploy () : Promise<boolean> {
    return this.isMockedZeroToken;
  }

  async postDeploy () {
    const {
      zeroToken,
      treasury,
      config: {
        deployer,
      },
    } = this.campaign;

    // Give allowance to the treasury
    await zeroToken.connect(deployer).approve(
      treasury.address,
      ethers.constants.MaxUint256
    );
  }
}

export default ZNSTreasuryDM;
