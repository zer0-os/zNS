import { IDeployCampaignConfig } from "./campaign/types";
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
import { getLogger } from "./logger/create-logger";


export const runZnsCampaign = async ({
  config,
  dbVersion,
} : {
  config : IDeployCampaignConfig;
  dbVersion ?: string;
}) => {
  // TODO dep: figure out the best place to put this at!
  hre.upgrades.silenceWarnings();

  const logger = getLogger();

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
