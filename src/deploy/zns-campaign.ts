import { IDeployCampaignConfig, TLogger } from "./campaign/types";
import { HardhatDeployer } from "./deployer/hardhat-deployer";
import { DeployCampaign } from "./campaign/deploy-campaign";
import {
  MeowTokenDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSDomainTokenDM, ZNSCurvePricerDM, ZNSRootRegistrarDM,
  ZNSRegistryDM, ZNSTreasuryDM, ZNSFixedPricerDM, ZNSSubRegistrarDM,
} from "./missions/contracts";
import * as hre from "hardhat";

import { getMongoAdapter } from "./db/mongo-adapter/get-adapter";


export const runZnsCampaign = async ({
  config,
  logger,
  dbVersion,
} : {
  config : IDeployCampaignConfig;
  logger : TLogger;
  dbVersion ?: string;
}) => {
  // TODO dep: figure out the best place to put this at!
  hre.upgrades.silenceWarnings();

  const deployer = new HardhatDeployer(config.deployAdmin);

  const dbAdapter = await getMongoAdapter();

  const campaign = new DeployCampaign({
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

  // TODO dep: find the best place to call these !
  await dbAdapter.finalizeDeployedVersion(dbVersion);

  return campaign;
};
