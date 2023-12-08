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
import { DefenderRelayProvider } from "@openzeppelin/defender-relay-client/lib/ethers";

interface CampaignParams {
  config : IDeployCampaignConfig;
  provider : DefenderRelayProvider;
  dbVersion ?: string;
  deployer ?: HardhatDeployer;
  // TODO def: add proper type for the provider
}

export const runZnsCampaign = async (args : CampaignParams) => {
  hre.upgrades.silenceWarnings();

  const logger = getLogger();

  const deployer = args.deployer 
    ? args.deployer 
    : new HardhatDeployer(args.config.deployAdmin, args.provider);

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
