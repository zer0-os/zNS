import { HardhatEthersSigner, SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { ICurvePriceConfig } from "../missions/types";
import { IContractState, IDeployCampaignConfig } from "@zero-tech/zdc";
import {
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
  ZNSStringResolver, ZNSZChainPortal, ZNSEthereumPortal, PolygonZkEVMBridgeV2Mock, ZNSChainResolver,
} from "../../../typechain";

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
  zeroVaultAddress : string;
  mockMeowToken : boolean;
  stakingTokenAddress : string;
  crosschain : {
    destNetworkId : bigint;
    destChainName : string;
    destChainId : bigint;
    destZkEvmBridge ?: string;
    srcZkEvmBridge ?: string;
    srcZnsPortal : string;
  };
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
  MeowTokenMock |
  MeowToken |
  ZNSAddressResolver |
  ZNSStringResolver |
  ZNSChainResolver |
  ZNSCurvePricer |
  ZNSTreasury |
  ZNSRootRegistrar |
  ZNSFixedPricer |
  ZNSSubRegistrar |
  ZNSZChainPortal |
  ZNSEthereumPortal |
  PolygonZkEVMBridgeV2Mock;

export interface IZNSContracts extends IContractState<ZNSContract> {
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  meowToken : MeowTokenMock;
  addressResolver : ZNSAddressResolver;
  stringResolver : ZNSStringResolver;
  chainResolver : ZNSChainResolver;
  curvePricer : ZNSCurvePricer;
  treasury : ZNSTreasury;
  rootRegistrar : ZNSRootRegistrar;
  fixedPricer : ZNSFixedPricer;
  subRegistrar : ZNSSubRegistrar;
  zPortal : ZNSZChainPortal;
  ethPortal : ZNSEthereumPortal;
}
