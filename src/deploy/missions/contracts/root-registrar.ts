import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, REGISTRAR_ROLE, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


export class ZNSRootRegistrarDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.rootRegistrar.contract;
  instanceName = znsNames.rootRegistrar.instance;

  deployArgs () : TDeployArgs {
    const {
      accessController,
      registry,
      curvePricer,
      treasury,
      domainToken,
      addressResolver,
    } = this.campaign;

    return [
      accessController.address,
      registry.address,
      // we use CurvePricer as the IZNSPricer for root domains
      curvePricer.address,
      treasury.address,
      domainToken.address,
      addressResolver.address,
    ];
  }

  async needsPostDeploy () {
    const {
      accessController,
      rootRegistrar,
      config: { deployAdmin },
    } = this.campaign;

    const isRegistrar = await accessController
      .connect(deployAdmin)
      .isRegistrar(rootRegistrar.address);

    return !isRegistrar;
  }

  async postDeploy () {
    const {
      accessController,
      rootRegistrar,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    await accessController
      .connect(deployAdmin)
      .grantRole(REGISTRAR_ROLE, rootRegistrar.address);
  }
}
