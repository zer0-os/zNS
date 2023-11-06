import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


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
      // TODO dep: add an enum of all types and use it here
      "address",
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
      // TODO dep: add an enum of all types and use it here
      "address",
      addressResolver.address,
    );
  }
}
