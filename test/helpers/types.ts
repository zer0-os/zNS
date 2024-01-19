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
  ZNSRootRegistrarUpgradeMock__factory,
  ZNSSubRegistrar,
  ZNSSubRegistrarUpgradeMock,
  ZNSSubRegistrarUpgradeMock__factory,
  ZNSTreasury,
  ZNSTreasuryUpgradeMock,
  ZNSTreasuryUpgradeMock__factory,
  MeowTokenMock,
  MeowToken,
} from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";
import { IContractState } from "@zero-tech/zdc";


export type Maybe<T> = T | undefined;

export type GeneralContractGetter = Promise<
string
| boolean
| BigInt
| Array<BigInt>
| [string, BigInt]
& { token : string; amount : BigInt; }
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

export type ZNSContract =
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

export interface IFixedPriceConfig {
  price : BigInt;
  feePercentage : BigInt;
}

export interface RegistrarConfig {
  treasuryAddress : string;
  registryAddress : string;
  curvePricerAddress : string;
  domainTokenAddress : string;
}

export interface IZNSContracts extends IContractState<ZNSContract> {
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

export interface DeployZNSParams {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  priceConfig ?: ICurvePriceConfig;
  registrationFeePerc ?: BigInt;
  zeroVaultAddress ?: string;
  isTenderlyRun ?: boolean;
}

export interface IDistributionConfig {
  pricerContract : string;
  paymentType : BigInt;
  accessType : BigInt;
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
  userBalanceBefore : BigInt;
  userBalanceAfter : BigInt;
  parentBalanceBefore : BigInt;
  parentBalanceAfter : BigInt;
  treasuryBalanceBefore : BigInt;
  treasuryBalanceAfter : BigInt;
  zeroVaultBalanceBefore : BigInt;
  zeroVaultBalanceAfter : BigInt;
}
