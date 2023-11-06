import { BaseDeployMission } from "..//base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { TDeployArgs } from "../types";
import { ethers } from "ethers";

const meowTokenName = "MEOW";
const meowTokenSymbol = "MEOW";

export class MeowTokenDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.transparent,
  };

  contractName = znsNames.meowToken.contract;
  instanceName = znsNames.meowToken.instance;

  deployArgs () : TDeployArgs {
    return [meowTokenName, meowTokenSymbol];
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
