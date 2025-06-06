import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds, REGISTRAR_ROLE } from "../../constants";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";
import { encodePriceConfig } from "../../../../test/helpers";


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

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      curvePricer,
      treasury,
      domainToken,
      config,
    } = this.campaign;

    return [
      await accessController.getAddress(),
      await registry.getAddress(),
      // we use CurvePricer as the IZNSPricer for root domains
      await curvePricer.getAddress(),
      encodePriceConfig(config.rootPriceConfig),
      await treasury.getAddress(),
      await domainToken.getAddress(),
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
      .isRegistrar(await rootRegistrar.getAddress());

    const msg = !isRegistrar ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

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
      .grantRole(REGISTRAR_ROLE, await rootRegistrar.getAddress());

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
