import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, REGISTRAR_ROLE } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";
import { Signer } from "ethers";


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
    const accessControllerAddress = this.campaign.state.contracts.accessController.target.toString();
    const registryAddress = this.campaign.state.contracts.registry.target.toString();
    const rootRegistrarAddress = this.campaign.state.contracts.rootRegistrar.target.toString();

    return [ accessControllerAddress, registryAddress, rootRegistrarAddress ];
  }

  async needsPostDeploy () {
    const {
      rootRegistrar,
      config: { deployAdmin },
    } = this.campaign;

    const accessController = this.campaign.state.contracts.accessController;
    const subRegistrarAddress = this.campaign.state.contracts.subRegistrar.target.toString();

    this.hasRegistrarRole = await accessController
      .connect(deployAdmin as unknown as Signer)
      .isRegistrar(subRegistrarAddress);

    const currentSubRegistrarOnRoot = await rootRegistrar.subRegistrar();
    this.isSetOnRoot = currentSubRegistrarOnRoot === subRegistrarAddress;

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
      config: {
        deployAdmin,
      },
    } = this.campaign;

    const accessController = this.campaign.state.contracts.accessController;
    const subRegistrarAddress = this.campaign.state.contracts.subRegistrar.target.toString();
    const rootRegistrar = this.campaign.state.contracts.rootRegistrar;

    if (!this.isSetOnRoot) {
      await rootRegistrar.connect(deployAdmin as unknown as Signer).setSubRegistrar(subRegistrarAddress);
    }

    if (!this.hasRegistrarRole) {
      await accessController
        .connect(deployAdmin as unknown as Signer)
        .grantRole(REGISTRAR_ROLE, subRegistrarAddress);
    }
  }
}
