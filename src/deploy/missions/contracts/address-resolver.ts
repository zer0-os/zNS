import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, ResolverTypes } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";
import { Signer } from "ethers";


export class ZNSAddressResolverDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.addressResolver.contract;
  instanceName = znsNames.addressResolver.instance;

  deployArgs () : TDeployArgs {
    const {
      accessController,
      registry,
    } = this.campaign.state.contracts;

    return [ accessController.target.toString(), registry.target.toString() ];
  }

  async needsPostDeploy () {
    // TODO def: add logging for all post tasks!
    const {
      registry,
      addressResolver,
    } = this.campaign.state.contracts;

    const resolverInReg = await registry.getResolverType(
      ResolverTypes.address,
    );

    return resolverInReg !== addressResolver.target.toString();
  }

  async postDeploy () {
    const {
      registry,
      addressResolver,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    await registry.connect(deployAdmin as unknown as Signer).addResolverType(
      ResolverTypes.address,
      addressResolver.target.toString(),
    );
  }
}
