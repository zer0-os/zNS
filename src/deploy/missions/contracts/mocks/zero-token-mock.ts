import { BaseDeployMission } from "../../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../../constants";
import { TDeployArgs } from "../../types";
import { ethers } from "ethers";


const zeroTokenName = "Zero Token";
const zeroTokenSymbol = "ZERO";


// TODO dep: refine this to create an object if using
//  the actual deployed ZERO, so that we have it's full object present
//  here for easy access and to make sure we get it's ABI and bytecode for the DB
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
