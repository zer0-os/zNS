import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, REGISTRAR_ROLE } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";


export class ZNSSubRegistrarDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.subRegistrar.contract;
  instanceName = znsNames.subRegistrar.instance;

  private hasRegistrarRole : boolean | undefined;
  private isSetOnRoot : boolean | undefined;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      rootRegistrar,
    } = this.campaign;

    return [await accessController.getAddress(), await registry.getAddress(), await rootRegistrar.getAddress()];
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
      .isRegistrar(await subRegistrar.getAddress());

    const currentSubRegistrarOnRoot = await rootRegistrar.subRegistrar();
    this.isSetOnRoot = currentSubRegistrarOnRoot === await subRegistrar.getAddress();

    const needs = !this.hasRegistrarRole || !this.isSetOnRoot;
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
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
      const tx = await rootRegistrar.connect(deployAdmin).setSubRegistrar(await subRegistrar.getAddress());
      await tx.wait(2);
    }

    if (!this.hasRegistrarRole) {
      const tx = await accessController
        .connect(deployAdmin)
        .grantRole(REGISTRAR_ROLE, await subRegistrar.getAddress());
      await tx.wait(2);
    }

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
