import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  HardhatDeployer,
  DeployCampaign,
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
import { getZnsLogger } from "./get-logger";


export const runZnsCampaign = async ({
  config,
  dbVersion,
  deployer,
} : {
  config : IZNSCampaignConfig;
  dbVersion ?: string;
  deployer ?: HardhatDeployer<HardhatRuntimeEnvironment, SignerWithAddress>;
}) => {
  hre.upgrades.silenceWarnings();

  const logger = getZnsLogger();

  if (!deployer) {
    deployer = new HardhatDeployer({
      hre,
      confirmationsN: config.confirmationsN,
      signer: config.deployAdmin,
      env: config.env,
    });
  }

  const dbAdapter = await getZnsMongoAdapter();

  const campaign = new DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZNSCampaignConfig,
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
      ZNSFixedPricerDM,
      ZNSTreasuryDM,
      ZNSRootRegistrarDM,
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
