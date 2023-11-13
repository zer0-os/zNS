import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, REGISTRAR_ROLE, znsNames } from "../../constants";
import { TDeployArgs } from "../types";


export class ZNSSubRegistrarDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.subRegistrar.contract;
  instanceName = znsNames.subRegistrar.instance;

  private hasRegistrarRole : boolean | undefined;
  private isSetOnRoot : boolean | undefined;

  deployArgs () : TDeployArgs {
    const {
      accessController,
      registry,
      rootRegistrar,
    } = this.campaign;

    return [ accessController.address, registry.address, rootRegistrar.address ];
  }

  async needsPostDeploy () {
    const {
      accessController,
      subRegistrar,
      rootRegistrar,
      config: { deployAdmin },
    } = this.campaign;

    this.hasRegistrarRole = await accessController
      .connect(deployAdmin)
      .isRegistrar(subRegistrar.address);

    const currentSubRegistrarOnRoot = await rootRegistrar.subRegistrar();
    this.isSetOnRoot = currentSubRegistrarOnRoot === subRegistrar.address;

    return !this.hasRegistrarRole || !this.isSetOnRoot;
  }

  async postDeploy () {
    if (typeof this.hasRegistrarRole === "undefined" || typeof this.isSetOnRoot === "undefined") {
      throw new Error(`
      Internal error, both options should be defined for ZNSSubRegistrar deploy.
      Current values: 'this.hasRegistrarRole': ${this.hasRegistrarRole}, 'this.isSetOnRoot': ${this.isSetOnRoot}
      `);
    }

    const {
      accessController,
      subRegistrar,
      rootRegistrar,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    if (!this.isSetOnRoot) {
      await rootRegistrar.connect(deployAdmin).setSubRegistrar(subRegistrar.address);
    }

    if (!this.hasRegistrarRole) {
      await accessController
        .connect(deployAdmin)
        .grantRole(REGISTRAR_ROLE, subRegistrar.address);
    }
  }
}
