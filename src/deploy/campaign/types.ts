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
  ZNSTreasury,
  MeowToken,
  ZNSStringResolver,
  ZNSZChainPortal,
  ZNSEthereumPortal,
  PolygonZkEVMBridgeV2Mock,
  ZNSChainResolver,
  ZNSRootRegistrarTrunk, ZNSRootRegistrarBranch, ZNSSubRegistrarTrunk, ZNSSubRegistrarBranch,
} from "../../../typechain";
import { TSupportedChain } from "../missions/contracts/cross-chain/portals/types";

export type IZNSSigner = HardhatEthersSigner | DefenderRelaySigner | SignerWithAddress;

export interface IZNSBaseCrossConfig {
  mockZkEvmBridge : boolean;
  zkEvmBridgeAddress ?: string;
  srcChainName : TSupportedChain;
  curNetworkId ?: bigint;
  bridgeToken ?: string;
}

export interface IZNSEthCrossConfig extends IZNSBaseCrossConfig {
  destNetworkId : bigint;
  destChainName : string;
  destChainId : bigint;
}

export interface IZNSZChainCrossConfig extends IZNSBaseCrossConfig {
  srcZnsPortal : string;
}

export type TZNSCrossConfig = IZNSEthCrossConfig | IZNSZChainCrossConfig;

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
  crosschain : TZNSCrossConfig;
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
  ZNSRootRegistrarTrunk |
  ZNSRootRegistrarBranch |
  ZNSFixedPricer |
  ZNSSubRegistrarTrunk |
  ZNSSubRegistrarBranch |
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
  rootRegistrar : ZNSRootRegistrarTrunk | ZNSRootRegistrarBranch;
  fixedPricer : ZNSFixedPricer;
  subRegistrar : ZNSSubRegistrarTrunk | ZNSSubRegistrarBranch;
  zPortal : ZNSZChainPortal;
  ethPortal : ZNSEthereumPortal;
  zkEvmBridge : PolygonZkEVMBridgeV2Mock;
}
