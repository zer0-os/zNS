import { HardhatEthersSigner, SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { ICurvePriceConfig, IZTokenConfig } from "../missions/types";
import { IContractState, IDeployCampaignConfig } from "@zero-tech/zdc";
import {
  ZNSAccessController,
  ZNSAddressResolver,
  ZNSCurvePricer,
  ZNSDomainToken,
  ZNSFixedPricer,
  ZNSRegistry,
  ZNSRootRegistrar,
  ZNSSubRegistrar,
  ZNSTreasury,
  ZToken,
  ZTokenMock,
} from "../../../typechain";
import { bigint } from "hardhat/internal/core/params/argumentTypes";

export type IZNSSigner = HardhatEthersSigner | DefenderRelaySigner | SignerWithAddress;

export interface IZNSCampaignConfig <Signer> extends IDeployCampaignConfig<Signer> {
  env : string;
  deployAdmin : Signer;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  domainToken : {
    name : string;
    symbol : string;
    defaultRoyaltyReceiver : string;
    defaultRoyaltyFraction : bigint;
  };
  rootPriceConfig : ICurvePriceConfig;
  zTokenConfig ?: IZTokenConfig;
  zeroVaultAddress : string;
  mockZToken : boolean;
  stakingTokenAddress : string;
  postDeploy : {
    tenderlyProjectSlug : string;
    monitorContracts : boolean;
    verifyContracts : boolean;
  };
}

export type ZNSContract =
  ZNSAccessController |
  ZNSRegistry |
  ZNSDomainToken |
  ZTokenMock |
  ZToken |
  ZNSAddressResolver |
  ZNSCurvePricer |
  ZNSTreasury |
  ZNSRootRegistrar |
  ZNSFixedPricer |
  ZNSSubRegistrar;

export interface IZNSContracts extends IContractState<ZNSContract> {
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  zToken : ZTokenMock;
  addressResolver : ZNSAddressResolver;
  curvePricer : ZNSCurvePricer;
  treasury : ZNSTreasury;
  rootRegistrar : ZNSRootRegistrar;
  fixedPricer : ZNSFixedPricer;
  subRegistrar : ZNSSubRegistrar;
}