import {
  BaseUpgradeMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds, REGISTRAR_ROLE } from "../../constants";
import { znsNames } from "./names";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSContracts } from "../../campaign/types";


export class ZNSSubRegistrarDM extends BaseUpgradeMission<
DefenderRelayProvider,
IZNSContracts
> {
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
      await rootRegistrar.connect(deployAdmin).setSubRegistrar(await subRegistrar.getAddress());
    }

    if (!this.hasRegistrarRole) {
      await accessController
        .connect(deployAdmin)
        .grantRole(REGISTRAR_ROLE, await subRegistrar.getAddress());
    }

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
