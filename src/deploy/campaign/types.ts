import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IContractState, IDeployCampaignConfig, TEnvironment } from "@zero-tech/zdc";
import {
  ERC20Mock,
  ZNSAccessController,
  ZNSAddressResolver,
  ZNSCurvePricer,
  ZNSDomainToken,
  ZNSFixedPricer,
  ZNSRegistry,
  ZNSRootRegistrar,
  ZNSSubRegistrar,
  ZNSTreasury,
  ZNSStringResolver,
  ZToken as MeowToken,
} from "../../../typechain";


export interface IZNSCampaignConfig extends IDeployCampaignConfig<SignerWithAddress> {
  env : TEnvironment;
  deployAdmin : SignerWithAddress;
  pauseRegistration ?: boolean;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  domainToken : {
    name : string;
    symbol : string;
    defaultRoyaltyReceiver : string;
    defaultRoyaltyFraction : bigint;
  };
  rootPaymentType : bigint;
  rootPricerType : string;
  rootPriceConfig : string;
  zeroVaultAddress : string;
  mockMeowToken : boolean;
  rootPaymentTokenAddress ?: string;
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
  ERC20Mock |
  MeowToken |
  ZNSAddressResolver |
  ZNSStringResolver |
  ZNSCurvePricer |
  ZNSTreasury |
  ZNSRootRegistrar |
  ZNSFixedPricer |
  ZNSSubRegistrar;

export interface IZNSContracts extends IContractState<ZNSContract> {
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  meowToken : ERC20Mock;
  addressResolver : ZNSAddressResolver;
  stringResolver : ZNSStringResolver;
  curvePricer : ZNSCurvePricer;
  treasury : ZNSTreasury;
  rootRegistrar : ZNSRootRegistrar;
  fixedPricer : ZNSFixedPricer;
  subRegistrar : ZNSSubRegistrar;
}

export interface IZNSContractsCache {
  meowToken : ERC20Mock;
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  addressResolver : ZNSAddressResolver;
  stringResolver : ZNSStringResolver;
  curvePricer : ZNSCurvePricer;
  treasury : ZNSTreasury;
  rootRegistrar : ZNSRootRegistrar;
  fixedPricer : ZNSFixedPricer;
  subRegistrar : ZNSSubRegistrar;
}
