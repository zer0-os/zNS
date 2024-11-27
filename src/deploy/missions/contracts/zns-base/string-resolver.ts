import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZNSCampaignConfig, IZNSContracts, IZNSSigner } from "../../../campaign/types";
import { ProxyKinds, ResolverTypes } from "../../../constants";
import { znsNames } from "../names";


export class ZNSStringResolverDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
IZNSSigner,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.stringResolver.contract;
  instanceName = znsNames.stringResolver.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const { accessController, registry } = this.campaign;

    return [
      await accessController.getAddress(),
      await registry.getAddress(),
    ];
  }

  async needsPostDeploy () {
    const {
      registry,
      stringResolver,
    } = this.campaign;

    const resolverInReg = await registry.getResolverType(
      ResolverTypes.string,
    );

    const needs = resolverInReg !== await stringResolver.getAddress();
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
  }

  async postDeploy () {
    const {
      registry,
      stringResolver,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    const tx = await registry.connect(deployAdmin).addResolverType(
      ResolverTypes.string,
      await stringResolver.getAddress(),
    );
    await this.awaitConfirmation(tx);

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
