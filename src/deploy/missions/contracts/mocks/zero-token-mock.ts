import { BaseDeployMission } from "../../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../../constants";
import { TDeployArgs } from "../../types";
import { ethers } from "ethers";


const zeroTokenName = "Zero Token";
const zeroTokenSymbol = "ZERO";


export class ZeroTokenMockDM extends BaseDeployMission {
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
      config: {
        deployAdmin,
      },
    } = this.campaign;

    // Mint 10,000 ZERO to the deployer
    await zeroToken.connect(deployAdmin).mint(
      deployAdmin.address,
      ethers.utils.parseEther("100000")
    );
  }
}
