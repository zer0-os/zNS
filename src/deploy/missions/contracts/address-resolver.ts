import {
  TDeployArgs,
  BaseUpgradeMission,
} from "@zero-tech/zdc";
import { ProxyKinds, ResolverTypes } from "../../constants";
import { znsNames } from "./names";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSAddressResolverDM extends BaseUpgradeMission<
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.addressResolver.contract;
  instanceName = znsNames.addressResolver.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const { accessController, registry } = this.campaign;

    return [await accessController.getAddress(), await registry.getAddress()];
  }

  async needsPostDeploy () {
    const {
      registry,
      addressResolver,
    } = this.campaign;

    const resolverInReg = await registry.getResolverType(
      ResolverTypes.address,
    );

    const needs = resolverInReg !== await addressResolver.getAddress();
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
  }

  async postDeploy () {
    const {
      registry,
      addressResolver,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    await registry.connect(deployAdmin).addResolverType(
      ResolverTypes.address,
      await addressResolver.getAddress(),
    );

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
