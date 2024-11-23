/* eslint-disable @typescript-eslint/no-shadow, no-shadow */
import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  HardhatDeployer,
  DeployCampaign,
  getLogger, IHardhatDeployerArgs, TDeployArgs, TProxyKind, IContractV6,
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
import { ContractTransactionResponse, Wallet } from "ethers";
import { getConfirmationsNumber } from "../../test/helpers/tx";


export const executeWithConfirmation = async (
  tx : Promise<ContractTransactionResponse>,
  confNum ?: number,
) => {
  confNum = confNum ?? getConfirmationsNumber();
  const txRes = await tx;
  return txRes.wait(confNum);
};

// TODO multi: move this or change zDC code to include this !!
class HardhatDeployerWrapper extends HardhatDeployer<HardhatRuntimeEnvironment, SignerWithAddress> {
  constructor ({
    hre,
    signer,
    env,
  } : IHardhatDeployerArgs<HardhatRuntimeEnvironment, SignerWithAddress>) {
    super({
      hre,
      signer,
      env,
    });
  }

  async deployProxy ({
    contractName,
    args,
    kind,
  } : {
    contractName : string;
    args : TDeployArgs;
    kind : TProxyKind;
  }) : Promise<IContractV6> {
    const contract = await super.deployProxy({
      contractName,
      args,
      kind,
    });

    if (this.env !== "dev") {
      // TODO multi: fix this in zDC since there is a wrong type in IContractV6 for this method
      const deployTx = contract.deploymentTransaction() as ContractTransactionResponse;
      // TODO multi: make the amount of blocks a var passed to deployed by the config ??
      if (deployTx) await deployTx.wait(2);
    }

    return contract;
  }

  async deployContract (contractName : string, args : TDeployArgs) : Promise<IContractV6> {
    const contract = await super.deployContract(contractName, args);

    if (this.env !== "dev") {
      // TODO multi: fix this in zDC since there is a wrong type in IContractV6 for this method
      const deployTx = contract.deploymentTransaction() as ContractTransactionResponse;
      // TODO multi: make the amount of blocks a var passed to deployed by the config ??
      //  this may be needed to be higher than 2 in times of network congestion
      if (deployTx) await deployTx.wait(2);
    }

    return contract;
  }
}

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

  const logger = getLogger();

  if (!deployer) {
    // TODO multi: change this when finalized !
    deployer = new HardhatDeployerWrapper({
      hre,
      signer: config.deployAdmin,
      env: config.env,
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
      getPortalDM(config.crosschain.srcChainName),
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
