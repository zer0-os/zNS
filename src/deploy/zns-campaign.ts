import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import {
  HardhatDeployer,
  DeployCampaign,
  getLogger,
} from "@zero-tech/zdc";
import {
  MeowTokenDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSStringResolverDM,
  ZNSDomainTokenDM, ZNSCurvePricerDM, ZNSRootRegistrarDM,
  ZNSRegistryDM, ZNSTreasuryDM, ZNSFixedPricerDM, ZNSSubRegistrarDM,
} from "./missions/contracts";
import { IZNSCampaignConfig, IZNSContracts } from "./campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getZnsMongoAdapter } from "./mongo";


export const runZnsCampaign = async ({
  config,
  provider,
  dbVersion,
  deployer,
} : {
  config : IZNSCampaignConfig<SignerWithAddress>;
  provider ?: DefenderRelayProvider;
  dbVersion ?: string;
  deployer ?: HardhatDeployer<HardhatRuntimeEnvironment, SignerWithAddress, DefenderRelayProvider>;
}) => {
  hre.upgrades.silenceWarnings();

  const logger = getLogger();

  if (!deployer) {
    deployer = new HardhatDeployer({
      hre,
      signer: config.deployAdmin,
      env: config.env,
      provider,
    });
  }

  const dbAdapter = await getZnsMongoAdapter();

  const campaign = new DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  DefenderRelayProvider,
  IZNSContracts
  >({
    missions: [
      ZNSAccessControllerDM,
      ZNSRegistryDM,
      ZNSDomainTokenDM,
      MeowTokenDM,
      ZNSAddressResolverDM,
      ZNSStringResolverDM,
      ZNSCurvePricerDM,
      ZNSTreasuryDM,
      ZNSRootRegistrarDM,
      ZNSFixedPricerDM,
      ZNSSubRegistrarDM,
    ],
    deployer,
    dbAdapter,
    logger,
    config,
  });

  await campaign.execute();

  await dbAdapter.finalize(dbVersion);

  return campaign;
};
