import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { DOMAIN_TOKEN_ROLE, ProxyKinds } from "../../../constants";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../../campaign/types";


export class ZNSDomainTokenDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.domainToken.contract;
  instanceName = znsNames.domainToken.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const { accessController, registry } = this.campaign;
    const {
      domainToken: {
        name,
        symbol,
        defaultRoyaltyReceiver,
        defaultRoyaltyFraction,
      },
    } = this.config;

    return [
      await accessController.getAddress(),
      name,
      symbol,
      defaultRoyaltyReceiver,
      defaultRoyaltyFraction,
      await registry.getAddress(),
    ];
  }

  async needsPostDeploy () {
    const {
      accessController,
      domainToken,
      config: { deployAdmin },
    } = this.campaign;

    const isDomainToken = await accessController
      .connect(deployAdmin)
      .isDomainToken(await domainToken.getAddress());

    const msg = !isDomainToken ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return !isDomainToken;
  }

  async postDeploy () {
    const {
      accessController,
      domainToken,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    await accessController
      .connect(deployAdmin)
      .grantRole(DOMAIN_TOKEN_ROLE, await domainToken.getAddress());

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
