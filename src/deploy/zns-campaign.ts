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
import * as hre from "hardhat";

import { getMongoAdapter } from "./db/mongo-adapter/get-adapter";
import { getLogger } from "./logger/create-logger";
import { Defender } from "@openzeppelin/defender-sdk";

interface MetaCampaignParams {
  config : IDeployCampaignConfig;
  client : Defender,
  dbVersion ?: string;
}

export const runZnsCampaign = async (args : MetaCampaignParams) => {
  hre.upgrades.silenceWarnings();

  const logger = getLogger();

  // Always use new deployer
  const deployer = new HardhatDeployer(args.client);

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
    config: args.config,
  });

  await campaign.execute();

  await dbAdapter.finalizeDeployedVersion(args.dbVersion);

  return campaign;
};
