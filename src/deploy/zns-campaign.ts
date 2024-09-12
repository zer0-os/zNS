import * as hre from "hardhat";
import {
  HardhatDeployer,
  DeployCampaign,
  getLogger,
} from "@zero-tech/zdc";
import {
  MeowTokenDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSDomainTokenDM, ZNSCurvePricerDM, ZNSRootRegistrarDM,
  ZNSRegistryDM, ZNSTreasuryDM, ZNSFixedPricerDM, ZNSSubRegistrarDM,
} from "./missions/contracts";
import { IZNSCampaignConfig, IZNSContracts } from "./campaign/types";
import { getZnsMongoAdapter } from "./mongo";


export const runZnsCampaign = async ({
  config,
  dbVersion,
  deployer,
} : {
  config : IZNSCampaignConfig;
  dbVersion ?: string;
  deployer ?: HardhatDeployer;
}) => {
  hre.upgrades.silenceWarnings();

  const logger = getLogger();

  if (!deployer) {
    deployer = new HardhatDeployer({
      hre,
      signer: config.deployAdmin,
      env: config.env,
    });
  }

  const dbAdapter = await getZnsMongoAdapter();

  const campaign = new DeployCampaign<
  IZNSCampaignConfig,
  IZNSContracts
  >({
    missions: [
      ZNSAccessControllerDM,
      ZNSRegistryDM,
      ZNSDomainTokenDM,
      MeowTokenDM,
      ZNSAddressResolverDM,
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
