import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


class TreasuryDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.treasury.contract;
  instanceName = znsNames.treasury.instance;

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

    const stakingToken = !!stakingTokenAddress
      ? stakingTokenAddress
      : zeroToken.address;

    if (!stakingToken) throw new Error(
      `No staking token address found!
      Please make sure to provide 'stakingTokenAddress' to the config
      or deploy mocked token if this is a test.`
    );

    return [
      accessController.address,
      priceOracle.address,
      stakingToken,
      zeroVaultAddress,
    ];
  }
}

export default TreasuryDM;
