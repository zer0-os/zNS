import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, REGISTRAR_ROLE, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


class ZNSRegistrarDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.registrar.contract;
  instanceName = znsNames.registrar.instance;

  deployArgs () : TDeployArgs {
    const {
      accessController,
      registry,
      treasury,
      domainToken,
      addressResolver,
    } = this.campaign;

    return [
      accessController.address,
      registry.address,
      treasury.address,
      domainToken.address,
      addressResolver.address,
    ];
  }

  async needsPostDeploy () {
    const {
      accessController,
      registrar,
      config: { deployAdmin },
    } = this.campaign;

    const isRegistrar = await accessController
      .connect(deployAdmin)
      .isRegistrar(registrar.address);

    return !isRegistrar;
  }

  async postDeploy () {
    const {
      accessController,
      registrar,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    await accessController
      .connect(deployAdmin)
      .grantRole(REGISTRAR_ROLE, registrar.address);
  }
}

export default ZNSRegistrarDM;
