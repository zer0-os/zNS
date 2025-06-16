import {
  ERC20Mock,
  ZNSAccessController,
  ZNSAddressResolver,
  ZNSAddressResolverUpgradeMock,
  ZNSAddressResolverUpgradeMock__factory,
  ZNSCurvePricer,
  ZNSCurvePricerUpgradeMock,
  ZNSCurvePricerUpgradeMock__factory,
  ZNSDomainToken,
  ZNSDomainTokenUpgradeMock,
  ZNSDomainTokenUpgradeMock__factory,
  ZNSFixedPricer,
  ZNSFixedPricerUpgradeMock,
  ZNSFixedPricerUpgradeMock__factory,
  ZNSRegistry,
  ZNSRegistryUpgradeMock,
  ZNSRegistryUpgradeMock__factory,
  ZNSRootRegistrar,
  ZNSRootRegistrarUpgradeMock,
  ZNSRootRegistrarUpgradeMock__factory, ZNSStringResolverUpgradeMock, ZNSStringResolverUpgradeMock__factory,
  ZNSSubRegistrar,
  ZNSSubRegistrarUpgradeMock,
  ZNSSubRegistrarUpgradeMock__factory,
  ZNSTreasury,
  ZNSTreasuryUpgradeMock,
  ZNSTreasuryUpgradeMock__factory,
} from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";
import { Addressable } from "ethers";
import { IZNSContracts } from "../../src/deploy/campaign/types";


export type GeneralContractGetter = Promise<
string
| boolean
| bigint
| Array<bigint>
| [string, bigint]
& { token : string; amount : bigint; }
| [string, string]
& { token : string; beneficiary : string; }
| ICurvePriceConfig
| IFixedPriceConfig
| IDistributionConfig
>;

export type ZNSContractMockFactory =
  ZNSRootRegistrarUpgradeMock__factory |
  ZNSSubRegistrarUpgradeMock__factory |
  ZNSCurvePricerUpgradeMock__factory |
  ZNSFixedPricerUpgradeMock__factory |
  ZNSTreasuryUpgradeMock__factory |
  ZNSRegistryUpgradeMock__factory |
  ZNSAddressResolverUpgradeMock__factory |
  ZNSDomainTokenUpgradeMock__factory |
  ZNSStringResolverUpgradeMock__factory;

export type ZNSContractMock =
  ZNSRootRegistrarUpgradeMock |
  ZNSSubRegistrarUpgradeMock |
  ZNSCurvePricerUpgradeMock |
  ZNSFixedPricerUpgradeMock |
  ZNSTreasuryUpgradeMock |
  ZNSRegistryUpgradeMock |
  ZNSAddressResolverUpgradeMock |
  ZNSDomainTokenUpgradeMock |
  ZNSStringResolverUpgradeMock;

export interface IFixedPriceConfig {
  price : bigint;
  feePercentage : bigint;
}

export interface RegistrarConfig {
  registryAddress : string;
  curvePricerAddress : string;
  curvePriceConfig : string;
  treasuryAddress : string;
  domainTokenAddress : string;
}

export interface IZNSContractsLocal {
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  meowToken : ERC20Mock;
  addressResolver : ZNSAddressResolver;
  curvePricer : ZNSCurvePricer;
  treasury : ZNSTreasury;
  rootRegistrar : ZNSRootRegistrar;
  fixedPricer : ZNSFixedPricer;
  subRegistrar : ZNSSubRegistrar;
  zeroVaultAddress : string;
}

export interface DeployZNSParams {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  registrationFeePerc ?: bigint;
  zeroVaultAddress ?: string;
  isTenderlyRun ?: boolean;
}

export interface IDistributionConfig {
  pricerContract : string | Addressable;
  priceConfig : string;
  paymentType : bigint;
  accessType : bigint;
}

export interface IPaymentConfig {
  token : string;
  beneficiary : string;
}

export interface IFullDistributionConfig {
  distrConfig : IDistributionConfig;
  paymentConfig : IPaymentConfig;
}

export interface CreateConfigArgs {
  user : SignerWithAddress;
  tokenOwner ?: string;
  domainLabel ?: string;
  parentHash ?: string;
  distrConfig ?: Partial<IDistributionConfig>;
  paymentConfig ?: Partial<IPaymentConfig>;
}

interface ConfigArgsBase {
  user : SignerWithAddress;
  domainLabel : string;
  tokenOwner ?: string;
  domainContent ?: string;
  parentHash ?: string;
  tokenURI ?: string;
}

export interface IDomainConfigForTest extends ConfigArgsBase {
  fullConfig : IFullDistributionConfig;
}

export interface IRegisterWithSetupArgs extends ConfigArgsBase {
  zns : IZNSContractsLocal | IZNSContracts;
  fullConfig ?: IFullDistributionConfig;
  setConfigs ?: boolean;
}

export interface DefaultRootRegistrationArgs {
  user : SignerWithAddress;
  zns : IZNSContractsLocal | IZNSContracts;
  domainName : string;
  tokenOwner ?: string;
  domainContent ?: string;
  tokenURI ?: string;
  distrConfig ?: IDistributionConfig;
  paymentConfig ?: IPaymentConfig;
}


export interface IPathRegResult {
  domainHash : string;
  userBalanceBefore : bigint;
  userBalanceAfter : bigint;
  parentBalanceBefore : bigint;
  parentBalanceAfter : bigint;
  treasuryBalanceBefore : bigint;
  treasuryBalanceAfter : bigint;
  zeroVaultBalanceBefore : bigint;
  zeroVaultBalanceAfter : bigint;
}

export interface IRootDomainConfig {
  name : string;
  domainAddress : string;
  tokenOwner : string;
  tokenURI : string;
  distrConfig : IDistributionConfig;
  paymentConfig : IPaymentConfig;
}

export interface ISubRegistrarConfig {
  parentHash : string;
  label : string;
  domainAddress : string;
  tokenOwner : string;
  tokenURI : string;
  distrConfig : IDistributionConfig;
  paymentConfig : IPaymentConfig;
}
