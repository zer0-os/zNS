import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, ResolverTypes } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";


export class ZNSAddressResolverDM extends BaseDeployMission {
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
    // TODO def: add logging for all post tasks!
    const {
      registry,
      addressResolver,
    } = this.campaign;

    const resolverInReg = await registry.getResolverType(
      ResolverTypes.address,
    );

    return resolverInReg !== await addressResolver.getAddress();
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
  }
}
