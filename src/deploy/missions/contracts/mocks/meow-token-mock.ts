import { BaseDeployMission } from "../../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../../constants";
import { TDeployArgs } from "../../types";
import { ethers } from "ethers";


const zeroTokenName = "Zero Token";
const zeroTokenSymbol = "ZERO";


// TODO dep !IMPORTANT!: refine this to create an object if using
//  the actual deployed MEOW, so that we have it's full object present
//  here for easy access and to make sure we get it's ABI and bytecode for the DB
export class MeowTokenMockDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.transparent,
  };

  contractName = znsNames.meowToken.contract;
  instanceName = znsNames.meowToken.instance;

  deployArgs () : TDeployArgs {
    return [zeroTokenName, zeroTokenSymbol];
  }

  async postDeploy () {
    const {
      meowToken,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    // Mint 10,000 ZERO to the deployer
    await meowToken.connect(deployAdmin).mint(
      deployAdmin.address,
      ethers.utils.parseEther("100000")
    );
  }
}
