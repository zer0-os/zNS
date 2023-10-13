import { IDeployCampaignConfig, TLogger } from "./campaign/types";
import { HardhatDeployer } from "./deployer/hardhat-deployer";
import { FileStorageAdapter } from "./storage/file-storage";
import { DeployCampaign } from "./campaign/deploy-campaign";
import {
  MeowTokenMockDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSDomainTokenDM, ZNSCurvePricerDM, ZNSRootRegistrarDM,
  ZNSRegistryDM, ZNSTreasuryDM, ZNSFixedPricerDM, ZNSSubRegistrarDM,
} from "./missions/contracts";
import * as hre from "hardhat";
import { MongoDBConnector } from "./db/mongo-connect/mongo-connector";


// TODO dep: add configs for ENV vars in this repo
export const runZnsCampaign = async ({
  config,
  logger,
  writeLocal,
} : {
  config : IDeployCampaignConfig;
  logger : TLogger;
  writeLocal ?: boolean;
}) => {
  // TODO dep: figure out the best place to put this at!
  hre.upgrades.silenceWarnings();

  const deployer = new HardhatDeployer();

  const dbAdapterIn = new MongoDBConnector({
    logger,
    dbUri: "mongodb://localhost:27017",
    dbName: "zns-campaign",
  });

  await dbAdapterIn.initialize();

  // TODO dep: remove this when MongoDB works properly
  // const dbAdapterIn = new FileStorageAdapter(logger, writeLocal);

  const campaign = new DeployCampaign({
    missions: [
      ZNSAccessControllerDM,
      ZNSRegistryDM,
      ZNSDomainTokenDM,
      // TODO dep: add proper class for MeowToken in prod,
      //  that is able to determine to deploy a mock for test
      //  or use the data for existing Meow on mainnet to create and object and save to state
      // TODO dep !IMPORTANT: make sure we publish the new MeowToken version properly
      //  and updated it in this repo!!!!
      MeowTokenMockDM,
      ZNSAddressResolverDM,
      ZNSCurvePricerDM,
      ZNSTreasuryDM,
      ZNSRootRegistrarDM,
      ZNSFixedPricerDM,
      ZNSSubRegistrarDM,
    ],
    deployer,
    // TODO dep: fix this typing!
    dbAdapter: dbAdapterIn,
    logger,
    config,
  });

  await campaign.execute();

  return campaign;
};
