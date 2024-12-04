import { BaseDeployMission, EnvironmentLevels, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZNSCampaignConfig, IZNSContracts, IZNSSigner, IZNSZChainCrossConfig } from "../../../../campaign/types";
import { PORTAL_ROLE, ProxyKinds } from "../../../../constants";
import { znsNames } from "../../names";
import { ethers } from "hardhat";
import { ZNSZChainPortal } from "../../../../../../typechain";


export class ZNSEthereumPortalDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
IZNSSigner,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.ethPortal.contract;
  instanceName = znsNames.ethPortal.instance;
  // Post Deploy Task Assessement
  pdNeed1 ?: boolean;
  pdNeed2 ?: boolean;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      domainToken,
      rootRegistrar,
      subRegistrar,
      zkEvmBridge,
      config: {
        crosschain,
      },
    } = this.campaign;

    const {
      zkEvmBridgeAddress,
      srcZnsPortal,
    } = crosschain as IZNSZChainCrossConfig;

    // TODO multi: figure out proper handling of this for actual contract AND mock !!!
    const bridgeAddress = !zkEvmBridgeAddress ? await zkEvmBridge.getAddress() : zkEvmBridgeAddress;

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
    this.pdNeed1 = await this.needsPortalRole();
    this.pdNeed2 = await this.needsLinkToZChainPortal();

    return this.pdNeed1 || this.pdNeed2;
  }

  async postDeploy () {
    if (this.pdNeed1) {
      await this.assignPortalRole();
    }

    if (this.pdNeed2) {
      await this.linkToZChainPortal();
    }
  }

  async assignPortalRole () {
    const {
      accessController,
      ethPortal,
      config: { deployAdmin },
    } = this.campaign;

    const tx = await accessController.connect(deployAdmin).grantRole(
      PORTAL_ROLE,
      ethPortal.target
    );
    await this.awaitConfirmation(tx);

    this.logger.debug(`${this.contractName} has been assigned PORTAL_ROLE`);
  }

  async needsPortalRole () {
    const {
      accessController,
      ethPortal,
    } = this.campaign;

    const hasPortalRole = await accessController.isPortal(await ethPortal.getAddress());

    const needs = !hasPortalRole;
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} to be assigned PORTAL_ROLE`);

    return needs;
  }

  async needsLinkToZChainPortal () {
    const {
      ethPortal,
      config: {
        env,
        deployAdmin,
        crosschain,
      },
    } = this.campaign;

    const {
      srcZnsPortal,
      ethAdmin,
    } = crosschain as IZNSZChainCrossConfig;

    const ethSigner = env === EnvironmentLevels.dev ? deployAdmin : ethAdmin;

    const zChainPortalEth = await ethers.getContractAt(
      znsNames.zPortal.contract,
      srcZnsPortal,
      ethSigner
    ) as unknown as ZNSZChainPortal;

    const destZnsPortalAddress = await zChainPortalEth.destZnsPortal();

    const needs = destZnsPortalAddress !== await ethPortal.getAddress();
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} linking to ${znsNames.zPortal.contract} on Ethereum`);

    if (needs) {
      this.campaign.updateStateContract(znsNames.zPortal.instance, znsNames.zPortal.contract, zChainPortalEth);
    }

    return needs;
  }

  async linkToZChainPortal () {
    const {
      ethPortal,
      zChainPortal,
      config: {
        crosschain,
      },
    } = this.campaign;

    const {
      srcZnsPortal,
    } = crosschain as IZNSZChainCrossConfig;

    this.logger.info(`Linking ${this.contractName} to ${znsNames.zPortal.contract} on Ethereum at ${srcZnsPortal}...`);

    const tx = await zChainPortal.setDestZnsPortal(await ethPortal.getAddress());
    await this.awaitConfirmation(tx);

    this.logger.info(`${this.contractName} linked to ${znsNames.zPortal.contract} successfully.`);
  }
}
