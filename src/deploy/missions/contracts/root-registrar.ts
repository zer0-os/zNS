import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { PricerTypes, ProxyKinds, REGISTRAR_ROLE } from "../../constants";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSRootRegistrarDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.rootRegistrar.contract;
  instanceName = znsNames.rootRegistrar.instance;

  private isRegistrar ?: boolean;
  private needsPause ?: boolean;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      curvePricer,
      fixedPricer,
      treasury,
      domainToken,
      config,
    } = this.campaign;

    const rootPricerAddress = config.rootPricerType === PricerTypes.curve
      ? await curvePricer.getAddress()
      : await fixedPricer.getAddress();

    return [
      await accessController.getAddress(),
      await registry.getAddress(),
      rootPricerAddress,
      config.rootPriceConfig,
      await treasury.getAddress(),
      await domainToken.getAddress(),
    ];
  }

  async needsPostDeploy () {
    const {
      accessController,
      rootRegistrar,
      config: {
        deployAdmin,
        pauseRegistration,
      },
    } = this.campaign;

    this.isRegistrar = await accessController
      .connect(deployAdmin)
      .isRegistrar(await rootRegistrar.getAddress());

    this.needsPause = pauseRegistration && !await rootRegistrar.registrationPaused();

    const needs = !this.isRegistrar || this.needsPause;

    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs as boolean;
  }

  async postDeploy () {
    const {
      accessController,
      rootRegistrar,
      config: {
        deployAdmin,
      },
      deployer,
    } = this.campaign;

    if (!this.isRegistrar) {
      const tx = await accessController
        .connect(deployAdmin)
        .grantRole(REGISTRAR_ROLE, await rootRegistrar.getAddress());

      await deployer.awaitConfirmation(tx);
    }

    if (this.needsPause) {
      const tx = await rootRegistrar
        .connect(deployAdmin)
        .pauseRegistration();

      await deployer.awaitConfirmation(tx);
    }

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
