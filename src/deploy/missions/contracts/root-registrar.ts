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
      deployer,
    } = this.campaign;

    const tx = await accessController
      .connect(deployAdmin)
      .grantRole(REGISTRAR_ROLE, await rootRegistrar.getAddress());

    await deployer.awaitConfirmation(tx);

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
