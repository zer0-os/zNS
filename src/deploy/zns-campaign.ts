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
  deployer,
  provider,
} : {
  config : IDeployCampaignConfig;
  dbVersion ?: string;
  deployer ?: HardhatDeployer;
  // TODO def: add proper type for the provider
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider ?: any;
}) => {
  hre.upgrades.silenceWarnings();

  const logger = getLogger();

  if (!deployer) deployer = new HardhatDeployer(config.deployAdmin, provider);

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

  await dbAdapter.finalizeDeployedVersion(dbVersion);

  return campaign;
};
