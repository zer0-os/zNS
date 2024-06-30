import {
  MeowTokenMock,
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
  ZNSRootRegistrarUpgradeMock__factory,
  ZNSSubRegistrar,
  ZNSSubRegistrarUpgradeMock,
  ZNSSubRegistrarUpgradeMock__factory,
  ZNSTreasury,
  ZNSTreasuryUpgradeMock,
  ZNSTreasuryUpgradeMock__factory,
} from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";

import {
  MeowTokenMock__factory,
  MeowTokenMock as MeowTokenMockType,
  ZNSAccessController__factory,
  ZNSAccessController as ZNSAccessControllerType, 
  ZNSAddressResolver__factory,
  ZNSAddressResolver as ZNSAddressResolverType,
  ZNSCurvePricer__factory, 
  ZNSCurvePricer as ZNSCurvePricerType,
  ZNSDomainToken__factory, 
  ZNSDomainToken as ZNSDomainTokenType,
  ZNSFixedPricer__factory,
  ZNSFixedPricer as ZNSFixedPricerType,
  ZNSRegistry__factory,
  ZNSRegistry as ZNSRegistryType,
  ZNSRootRegistrar__factory,
  ZNSRootRegistrar as ZNSRootRegistrarType,
  ZNSSubRegistrar__factory,
  ZNSSubRegistrar as ZNSSubRegistrarType,
  ZNSTreasury__factory,
  ZNSTreasury as ZNSTreasuryType,
} from "../../typechain";

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
  ZNSDomainTokenUpgradeMock__factory;

export type ZNSContractMock =
  ZNSRootRegistrarUpgradeMock |
  ZNSSubRegistrarUpgradeMock |
  ZNSCurvePricerUpgradeMock |
  ZNSFixedPricerUpgradeMock |
  ZNSTreasuryUpgradeMock |
  ZNSRegistryUpgradeMock |
  ZNSAddressResolverUpgradeMock |
  ZNSDomainTokenUpgradeMock;

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
  accessController : ZNSAccessControllerType;
  registry : ZNSRegistryType;
  domainToken : ZNSDomainTokenType;
  meowToken : MeowTokenMockType;
  addressResolver : ZNSAddressResolverType;
  curvePricer : ZNSCurvePricerType;
  treasury : ZNSTreasuryType;
  rootRegistrar : ZNSRootRegistrarType;
  fixedPricer : ZNSFixedPricerType;
  subRegistrar : ZNSSubRegistrarType;
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
