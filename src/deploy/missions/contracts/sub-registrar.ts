import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds, REGISTRAR_ROLE } from "../../constants";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSSubRegistrarDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.subRegistrar.contract;
  instanceName = znsNames.subRegistrar.instance;

  private hasRegistrarRole ?: boolean;
  private isSetOnRoot ?: boolean;
  private needsPause ?: boolean;

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
      config: { pauseRegistration },
    } = this.campaign;

    this.hasRegistrarRole = await accessController
      .isRegistrar(await subRegistrar.getAddress());

    const currentSubRegistrarOnRoot = await rootRegistrar.subRegistrar();
    this.isSetOnRoot = currentSubRegistrarOnRoot === await subRegistrar.getAddress();

    this.needsPause = pauseRegistration && !await subRegistrar.registrationPaused();

    const needs = !this.hasRegistrarRole || !this.isSetOnRoot || this.needsPause;
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs as boolean;
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
      deployer,
    } = this.campaign;

    if (!this.isSetOnRoot) {
      const tx = await rootRegistrar.connect(deployAdmin).setSubRegistrar(await subRegistrar.getAddress());

      await deployer.awaitConfirmation(tx);
    }

    if (!this.hasRegistrarRole) {
      const tx = await accessController
        .connect(deployAdmin)
        .grantRole(REGISTRAR_ROLE, await subRegistrar.getAddress());

      await deployer.awaitConfirmation(tx);
    }

    if (this.needsPause) {
      const tx = await subRegistrar
        .connect(deployAdmin)
        .pauseRegistration();

      await deployer.awaitConfirmation(tx);
    }

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
