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
  ZNSTreasuryUpgradeMock__factory, ZeroToken,
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

export interface PriceParams {
  maxPrice : BigNumber;
  minPrice : BigNumber;
  maxLength : BigNumber;
  baseLength : BigNumber;
  priceMultiplier : BigNumber;
  precisionMultiplier : BigNumber;
}

export interface RegistrarConfig {
  treasury : ZNSTreasury;
  registryAddress : string;
  domainTokenAddress : string;
  addressResolverAddress : string;
}

export interface ZNSContracts {
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  zeroToken : ZeroToken;
  addressResolver : ZNSAddressResolver;
  priceOracle : ZNSPriceOracle;
  treasury : ZNSTreasury;
  registrar : ZNSRegistrar;
}

export interface DeployZNSParams {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  priceConfig ?: PriceParams;
  registrationFeePerc ?: BigNumber;
  zeroVaultAddress ?: string;
  isTenderlyRun ?: boolean;
}
