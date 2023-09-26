import { BigNumber } from "ethers";
import {
  ZNSAddressResolver,
  ZNSDomainToken,
  ZNSRootRegistrar,
  ZNSRegistry,
  ZNSTreasury,
  ZNSAccessController,
  ZNSRootRegistrarUpgradeMock,
  ZNSCurvePricerUpgradeMock,
  ZNSAddressResolverUpgradeMock,
  ZNSDomainTokenUpgradeMock,
  ZNSRegistryUpgradeMock,
  ZNSTreasuryUpgradeMock,
  ZNSAddressResolverUpgradeMock__factory,
  ZNSDomainTokenUpgradeMock__factory,
  ZNSRootRegistrarUpgradeMock__factory,
  ZNSCurvePricerUpgradeMock__factory,
  ZNSRegistryUpgradeMock__factory,
  ZNSTreasuryUpgradeMock__factory,
  ZeroToken,
  ZNSSubRegistrar,
  ZNSCurvePricer,
  ZNSFixedPricer,
  ZNSFixedPricerUpgradeMock,
  ZNSSubRegistrarUpgradeMock,
  ZNSSubRegistrarUpgradeMock__factory, ZNSFixedPricerUpgradeMock__factory,
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AccessType, PaymentType } from "./constants";


export type Maybe<T> = T | undefined;

export type GeneralContractGetter = Promise<
string
| boolean
| BigNumber
| Array<BigNumber>
| [string, BigNumber]
& { token : string; amount : BigNumber; }
|[string, string]
& { token : string; beneficiary : string; }
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

export type ZNSContract =
  ZNSRootRegistrar |
  ZNSSubRegistrar |
  ZNSCurvePricer |
  ZNSFixedPricer |
  ZNSTreasury |
  ZNSRegistry |
  ZNSAddressResolver |
  ZNSDomainToken;

export interface ICurvePriceConfig {
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
  curvePricerAddress : string;
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
  registrationFeePerc ?: BigNumber;
  zeroVaultAddress ?: string;
  isTenderlyRun ?: boolean;
}

export interface IDistributionConfig {
  pricerContract : string;
  paymentType : PaymentType;
  accessType : AccessType;
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
  userBalanceBefore : BigNumber;
  userBalanceAfter : BigNumber;
  parentBalanceBefore : BigNumber;
  parentBalanceAfter : BigNumber;
  treasuryBalanceBefore : BigNumber;
  treasuryBalanceAfter : BigNumber;
  zeroVaultBalanceBefore : BigNumber;
  zeroVaultBalanceAfter : BigNumber;
}
