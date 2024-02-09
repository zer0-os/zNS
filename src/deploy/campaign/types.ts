import { HardhatEthersSigner, SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { ICurvePriceConfig } from "../missions/types";
import { IContractState, IDeployCampaignConfig } from "@zero-tech/zdc";
import {
  EIP712Helper,
  MeowTokenMock,
  ZNSAccessController,
  ZNSAddressResolver,
  ZNSCurvePricer,
  ZNSDomainToken,
  ZNSFixedPricer,
  ZNSRegistry,
  ZNSRootRegistrar,
  ZNSSubRegistrar,
  ZNSTreasury,
  MeowToken,
} from "../../../typechain";

export type IZNSSigner = HardhatEthersSigner | DefenderRelaySigner | SignerWithAddress;

export interface IZNSCampaignConfig <Signer> extends IDeployCampaignConfig <Signer> {
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
  zeroVaultAddress : string;
  mockMeowToken : boolean;
  stakingTokenAddress : string;
  eip712Config : {
    name : string;
    version : string;
  };
  postDeploy : {
    tenderlyProjectSlug : string;
    monitorContracts : boolean;
    verifyContracts : boolean;
  };
}

export type ZNSContract =
  EIP712Helper |
  ZNSAccessController |
  ZNSRegistry |
  ZNSDomainToken |
  MeowTokenMock |
  MeowToken |
  ZNSAddressResolver |
  ZNSCurvePricer |
  ZNSTreasury |
  ZNSRootRegistrar |
  ZNSFixedPricer |
  ZNSSubRegistrar;

export interface IZNSContracts extends IContractState<ZNSContract> {
  eip712Helper : EIP712Helper;
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  meowToken : MeowTokenMock;
  addressResolver : ZNSAddressResolver;
  curvePricer : ZNSCurvePricer;
  treasury : ZNSTreasury;
  rootRegistrar : ZNSRootRegistrar;
  fixedPricer : ZNSFixedPricer;
  subRegistrar : ZNSSubRegistrar;
}