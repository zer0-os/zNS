import { BaseDeployMission } from "../../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../../constants";
import { TDeployArgs } from "../../types";
import { ethers } from "ethers";


const zeroTokenName = "Zero Token";
const zeroTokenSymbol = "ZERO";


class ZeroTokenMockDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.transparent,
  };

  contractName = znsNames.zeroToken.contract;
  instanceName = znsNames.zeroToken.instance;

  deployArgs () : TDeployArgs {
    return [zeroTokenName, zeroTokenSymbol];
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

    // Mint 10,000 ZERO to the deployer
    await zeroToken.connect(deployer).mint(
      deployer.address,
      ethers.utils.parseEther("100000")
    );
  }
}

export default ZeroTokenMockDM;
