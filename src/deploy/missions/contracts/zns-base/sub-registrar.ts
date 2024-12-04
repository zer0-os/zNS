import {
  BaseDeployMission, IDeployMissionArgs,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds, REGISTRAR_ROLE } from "../../../constants";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZNSCampaignConfig, IZNSContracts, IZNSSigner } from "../../../campaign/types";
import { SupportedChains } from "../cross-chain/portals/get-portal-dm";


export class ZNSSubRegistrarDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
IZNSSigner,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.subRegistrar.contractTrunk;
  instanceName = znsNames.subRegistrar.instance;

  private hasRegistrarRole : boolean | undefined;
  private isSetOnRoot : boolean | undefined;

  constructor (args : IDeployMissionArgs<
  HardhatRuntimeEnvironment,
  IZNSSigner,
  IZNSCampaignConfig,
  IZNSContracts
  >) {
    super(args);

    if (this.config.srcChainName === SupportedChains.eth) {
      this.contractName = znsNames.subRegistrar.contractTrunk;
    } else if (this.config.srcChainName === SupportedChains.z) {
      this.contractName = znsNames.subRegistrar.contractBranch;
    } else {
      throw new Error("Unsupported chain for Root Registrar deployment");
    }
  }

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
      await this.awaitConfirmation(tx);
    }

    if (!this.hasRegistrarRole) {
      const tx = await accessController
        .connect(deployAdmin)
        .grantRole(REGISTRAR_ROLE, await subRegistrar.getAddress());
      await this.awaitConfirmation(tx);
    }

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
