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
    const { registrar, config: { deployer } } = this.campaign;

    const isRegistrar = await registrar
      .connect(deployer)
      .isRegistrar(registrar.address);

    return !isRegistrar;
  }

  async postDeploy () {
    const {
      accessController,
      registrar,
      config: {
        deployer,
      },
    } = this.campaign;

    await accessController
      .connect(deployer)
      .grantRole(REGISTRAR_ROLE, registrar.address);
  }
}

export default ZNSRegistrarDM;
