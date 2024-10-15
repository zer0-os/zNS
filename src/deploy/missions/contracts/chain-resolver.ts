import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";
import { BaseDeployMission } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ProxyKinds, ResolverTypes } from "../../constants";
import { znsNames } from "./names";


export class ZNSChainResolverDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.chainResolver.contract;
  instanceName = znsNames.chainResolver.instance;

  async deployArgs () {
    const {
      accessController,
      registry,
    } = this.campaign;

    return [await accessController.getAddress(), await registry.getAddress()];
  }

  async needsPostDeploy () {
    const {
      registry,
      chainResolver,
    } = this.campaign;

    const resolverInReg = await registry.getResolverType(
      ResolverTypes.chain,
    );

    const needs = resolverInReg !== await chainResolver.getAddress();
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
  }

  async postDeploy () {
    const {
      registry,
      chainResolver,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    await registry.connect(deployAdmin).addResolverType(
      ResolverTypes.chain,
      await chainResolver.getAddress(),
    );

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
