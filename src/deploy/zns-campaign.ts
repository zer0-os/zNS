/* eslint-disable @typescript-eslint/no-shadow, no-shadow */
import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  HardhatDeployer,
  DeployCampaign,
} from "@zero-tech/zdc";
import {
  MeowTokenDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSStringResolverDM,
  ZNSDomainTokenDM, ZNSCurvePricerDM, ZNSRootRegistrarDM,
  ZNSRegistryDM, ZNSTreasuryDM, ZNSFixedPricerDM, ZNSSubRegistrarDM, PolygonZkEVMBridgeV2DM, ZNSChainResolverDM,
} from "./missions/contracts";
import { IZNSCampaignConfig, IZNSContracts, IZNSSigner } from "./campaign/types";
import { getZnsMongoAdapter } from "./mongo";
import { getPortalDM } from "./missions/contracts/cross-chain/portals/get-portal-dm";
import { getZnsLogger } from "./logger";


export const runZnsCampaign = async ({
  config,
  dbVersion,
  deployer,
} : {
  config : IZNSCampaignConfig;
  dbVersion ?: string;
  deployer ?: HardhatDeployer<HardhatRuntimeEnvironment, IZNSSigner>;
}) => {
  // TODO multi: decide what to do with these
  // hre.upgrades.silenceWarnings();

  const logger = getZnsLogger();

  const {
    deployAdmin,
    env,
    confirmationsN,
    srcChainName,
  } = config;

  if (!deployer) {
    deployer = new HardhatDeployer({
      hre,
      signer: deployAdmin,
      env,
      confirmationsN,
    });
  }

  const dbAdapter = await getZnsMongoAdapter();

  const campaign = new DeployCampaign<
  HardhatRuntimeEnvironment,
  IZNSSigner,
  IZNSCampaignConfig,
  IZNSContracts
  >({
    missions: [
      ZNSAccessControllerDM,
      ZNSRegistryDM,
      ZNSDomainTokenDM,
      MeowTokenDM,
      ZNSAddressResolverDM,
      ZNSStringResolverDM,
      ZNSCurvePricerDM,
      ZNSTreasuryDM,
      ZNSRootRegistrarDM,
      ZNSSubRegistrarDM,
      ZNSFixedPricerDM,
      ZNSChainResolverDM,
      PolygonZkEVMBridgeV2DM,
      getPortalDM(srcChainName),
    ],
    deployer,
    dbAdapter,
    logger,
    config,
  });

  await campaign.execute();

  await dbAdapter.finalize(dbVersion);

  // TODO multi: add setting L2 portal address on L1 portal here for prod !!!!!!
  //  find a good way to acquire this from the DB or something else possibly

  return campaign;
};
