import { BigNumber } from "ethers";
import {
  ZNSAddressResolver,
  ZNSDomainToken,
  ZNSRegistrar,
  ZNSPriceOracle,
  ZNSRegistry,
  ZNSTreasury,
  ZNSAccessController,
  ZNSRegistrarUpgradeMock,
  ZNSPriceOracleUpgradeMock,
  ZNSAddressResolverUpgradeMock,
  ZNSDomainTokenUpgradeMock,
  ZNSRegistryUpgradeMock,
  ZNSTreasuryUpgradeMock,
  ZNSAddressResolverUpgradeMock__factory,
  ZNSDomainTokenUpgradeMock__factory,
  ZNSRegistrarUpgradeMock__factory,
  ZNSPriceOracleUpgradeMock__factory,
  ZNSRegistryUpgradeMock__factory,
  ZNSTreasuryUpgradeMock__factory,
  ZeroToken,
  ZNSFixedPricing,
  ZNSDirectPayment,
  ZNSSubdomainRegistrar,
  ZNSStakePayment,
  ZNSAsymptoticPricing,
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AccessType } from "./constants";

export type Maybe<T> = T | undefined;

export type GetterFunction = Promise<string | boolean | BigNumber | Array<BigNumber>>;

export type ZNSContractMockFactory =
  ZNSRegistrarUpgradeMock__factory |
  ZNSPriceOracleUpgradeMock__factory |
  ZNSTreasuryUpgradeMock__factory |
  ZNSRegistryUpgradeMock__factory |
  ZNSAddressResolverUpgradeMock__factory |
  ZNSDomainTokenUpgradeMock__factory;

export type ZNSContractMock =
  ZNSRegistrarUpgradeMock |
  ZNSPriceOracleUpgradeMock |
  ZNSTreasuryUpgradeMock |
  ZNSRegistryUpgradeMock |
  ZNSAddressResolverUpgradeMock |
  ZNSDomainTokenUpgradeMock;

export type ZNSContract =
  ZNSRegistrar |
  ZNSPriceOracle |
  ZNSTreasury |
  ZNSRegistry |
  ZNSAddressResolver |
  ZNSDomainToken;

export interface IASPriceConfig {
  maxPrice : BigNumber;
  minPrice : BigNumber;
  maxLength : BigNumber;
  baseLength : BigNumber;
  precisionMultiplier : BigNumber;
  feePercentage : BigNumber;
}

export interface IFixedPriceConfig {
  price : BigNumber;
  feePercentage : BigNumber;
}

export interface RegistrarConfig {
  treasury : ZNSTreasury;
  registryAddress : string;
  priceOracleAddress : string;
  domainTokenAddress : string;
  addressResolverAddress : string;
}

// TODO sub: rename to IZNS
export interface ZNSContracts {
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  zeroToken : ZeroToken;
  addressResolver : ZNSAddressResolver;
  priceOracle : ZNSPriceOracle;
  treasury : ZNSTreasury;
  registrar : ZNSRegistrar;
  fixedPricing : ZNSFixedPricing;
  asPricing : ZNSAsymptoticPricing;
  directPayment : ZNSDirectPayment;
  stakePayment : ZNSStakePayment;
  subdomainRegistrar : ZNSSubdomainRegistrar;
  zeroVaultAddress : string;
}

export interface DeployZNSParams {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  priceConfig ?: IASPriceConfig;
  registrationFeePerc ?: BigNumber;
  zeroVaultAddress ?: string;
  isTenderlyRun ?: boolean;
}

export interface IDistributionConfig {
  pricingContract : string;
  paymentContract : string;
  accessType : AccessType;
}

export interface IPaymentConfig {
  paymentToken : string;
  beneficiary : string;
}

export interface IFullDistributionConfig {
  distrConfig : IDistributionConfig;
  priceConfig : IASPriceConfig | IFixedPriceConfig | undefined;
  paymentConfig : IPaymentConfig;
}

export interface IDomainConfigForTest {
  user : SignerWithAddress;
  domainLabel : string;
  domainContent ?: string;
  parentHash ?: string;
  fullConfig : IFullDistributionConfig;
}

export interface IPathRegResult {
  domainHash : string;
  userBalanceBefore : BigNumber;
  userBalanceAfter : BigNumber;
  parentBalanceBefore : BigNumber;
  parentBalanceAfter : BigNumber;
}
