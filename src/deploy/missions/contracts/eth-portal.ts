import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";
import { PORTAL_ROLE, ProxyKinds } from "../../constants";
import { znsNames } from "./names";


export class ZNSEthPortalDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.ethPortal.contract;
  instanceName = znsNames.ethPortal.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      domainToken,
      rootRegistrar,
      subRegistrar,
      zkEvmBridge,
      config: {
        crosschain: {
          destZkEvmBridge,
          srcZnsPortal,
        },
      },
    } = this.campaign;

    // TODO multi: figure out proper handling of this for actual contract AND mock !!!
    const bridgeAddress = !destZkEvmBridge ? await zkEvmBridge.getAddress() : destZkEvmBridge;

    return [
      await accessController.getAddress(),
      bridgeAddress,
      srcZnsPortal,
      await registry.getAddress(),
      await domainToken.getAddress(),
      await rootRegistrar.getAddress(),
      await subRegistrar.getAddress(),
    ];
  }

  async needsPostDeploy () {
    const {
      accessController,
      ethPortal,
    } = this.campaign;

    const hasPortalRole = await accessController.isPortal(await ethPortal.getAddress());

    const needs = !hasPortalRole;
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
  }

  async postDeploy () {
    const {
      accessController,
      ethPortal,
      config: { deployAdmin },
    } = this.campaign;

    await accessController.connect(deployAdmin).grantRole(
      PORTAL_ROLE,
      ethPortal.target
    );

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}