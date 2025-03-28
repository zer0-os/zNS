import * as hre from "hardhat";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";

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
import { getMongoAdapter } from "./db/mongo-adapter/get-adapter";
import { getLogger } from "./logger/create-logger";


export const runZnsCampaign = async ({
  config,
  provider,
  dbVersion,
  deployer,
} : {
  config : IDeployCampaignConfig;
  provider ?: DefenderRelayProvider;
  dbVersion ?: string;
  deployer ?: HardhatDeployer;
}) => {
  hre.upgrades.silenceWarnings();

  const logger = getLogger();

  if (!deployer) {
    deployer = new HardhatDeployer(config.deployAdmin, config.env, provider);
  }

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
