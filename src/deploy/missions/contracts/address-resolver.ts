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

  deployArgs () : TDeployArgs {
    const { accessController, registry } = this.campaign;

    return [ accessController.address, registry.address ];
  }

  async needsPostDeploy () {
    const {
      registry,
      addressResolver,
    } = this.campaign;

    const resolverInReg = await registry.getResolverType(
      ResolverTypes.address,
    );

    return resolverInReg !== addressResolver.address;
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
      addressResolver.address,
    );
  }
}
