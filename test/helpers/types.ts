import {
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
  ZTokenMock,
} from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";


export type Maybe<T> = T | undefined;

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
  treasuryAddress : string;
  registryAddress : string;
  curvePricerAddress : string;
  domainTokenAddress : string;
}

export interface IZNSContractsLocal {
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
  zeroVaultAddress : string;
}

export interface DeployZNSParams {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  priceConfig ?: ICurvePriceConfig;
  registrationFeePerc ?: bigint;
  zeroVaultAddress ?: string;
  isTenderlyRun ?: boolean;
}

export interface IDistributionConfig {
  pricerContract : string;
  paymentType : bigint;
  accessType : bigint;
}

export interface IPaymentConfig {
  token : string;
  beneficiary : string;
}

export interface IFullDistributionConfig {
  paymentConfig : IPaymentConfig;
  distrConfig : IDistributionConfig;
  priceConfig : ICurvePriceConfig | IFixedPriceConfig | undefined;
}

export interface IDomainConfigForTest {
  user : SignerWithAddress;
  domainLabel : string;
  domainContent ?: string;
  parentHash ?: string;
  fullConfig : IFullDistributionConfig;
  tokenURI ?: string;
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
