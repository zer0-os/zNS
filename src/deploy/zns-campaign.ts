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
import { IZNSCampaignConfig, IZNSContracts } from "./campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getZnsMongoAdapter } from "./mongo";
import { getPortalDM } from "./missions/contracts/cross-chain/portals/get-portal-dm";
import { Wallet } from "ethers";
import { getZnsLogger } from "./logger";


export const runZnsCampaign = async ({
  config,
  dbVersion,
  deployer,
} : {
  config : IZNSCampaignConfig<SignerWithAddress | Wallet>;
  dbVersion ?: string;
  deployer ?: HardhatDeployer<HardhatRuntimeEnvironment, SignerWithAddress>;
}) => {
  hre.upgrades.silenceWarnings();

  const logger = getZnsLogger();

  const {
    deployAdmin,
    env,
    confirmationsN,
    srcChainName,
  } = config;

  if (!deployer) {
    // TODO multi: change this when finalized !
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
  SignerWithAddress,
  IZNSCampaignConfig<SignerWithAddress>,
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
