import { ICampaignArgs, IDeployCampaignConfig, TLogger } from "./campaign/types";
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
import { getMongoAdapter } from "./db/mongo-connect/mongo-adapter";


// TODO dep: add configs for ENV vars in this repo
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

  const deployer = new HardhatDeployer();

  // let dbAdapterIn;

  const dbAdapterIn = await getMongoAdapter();
  
  // if(process.env.ENV_LEVEL === "dev") {
  //   // Always clear before running again  
  //   await dbAdapterIn.dropDB();
  // }

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
    dbAdapter: dbAdapterIn!,
    logger,
    config,
  } as ICampaignArgs);

  await campaign.execute();

  // TODO dep: find the best place to call these !
  await dbAdapterIn.finalizeDeployedVersion(dbVersion);

  return campaign;
};
