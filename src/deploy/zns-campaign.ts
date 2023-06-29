import { IDeployCampaignConfig, Logger } from "./campaign/types";
import { HardhatDeployer } from "./deployer/hardhat-deployer";
import { FileStorageAdapter } from "./storage/file-storage";
import { DeployCampaign } from "./campaign/deploy-campaign";
import {
  ZeroTokenMockDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSDomainTokenDM, ZNSPriceOracleDM, ZNSRegistrarDM,
  ZNSRegistryDM, ZNSTreasuryDM,
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
      ZeroTokenMockDM,
      ZNSAddressResolverDM,
      ZNSPriceOracleDM,
      ZNSTreasuryDM,
      ZNSRegistrarDM,
    ],
    deployer,
    dbAdapter: dbAdapterIn,
    logger,
    config,
  });

  await campaign.execute();

  return campaign;
};
