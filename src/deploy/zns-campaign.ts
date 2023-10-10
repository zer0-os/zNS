import { IDeployCampaignConfig, Logger } from "./campaign/types";
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


export const runZnsCampaign = async ({
  config,
  logger,
} : {
  config : IDeployCampaignConfig;
  logger : Logger;
}) => {
  const deployer = new HardhatDeployer();
  const dbAdapterIn = new FileStorageAdapter(logger);

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
    dbAdapter: dbAdapterIn,
    logger,
    config,
  });

  await campaign.execute();

  return campaign;
};
