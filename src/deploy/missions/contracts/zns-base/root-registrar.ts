import {
  BaseDeployMission, IDeployMissionArgs,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds, REGISTRAR_ROLE } from "../../../constants";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../../campaign/types";
import { SupportedChains } from "../cross-chain/portals/get-portal-dm";


export class ZNSRootRegistrarDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.rootRegistrar.contractBase;
  instanceName = znsNames.rootRegistrar.instance;

  constructor (args : IDeployMissionArgs<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZNSCampaignConfig<SignerWithAddress>,
  IZNSContracts
  >) {
    super(args);

    if (this.config.srcChainName === SupportedChains.eth) {
      this.contractName = znsNames.rootRegistrar.contractTrunk;
    } else if (this.config.srcChainName === SupportedChains.z) {
      this.contractName = znsNames.rootRegistrar.contractBranch;
    } else {
      throw new Error("Unsupported chain for Root Registrar deployment");
    }
  }

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      curvePricer,
      treasury,
      domainToken,
    } = this.campaign;

    return [
      await accessController.getAddress(),
      await registry.getAddress(),
      // we use CurvePricer as the IZNSPricer for root domains
      await curvePricer.getAddress(),
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

    const tx = await accessController
      .connect(deployAdmin)
      .grantRole(REGISTRAR_ROLE, await rootRegistrar.getAddress());
    await this.awaitConfirmation(tx);

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
