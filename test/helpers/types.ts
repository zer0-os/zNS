import { BigNumber } from "ethers";
import {
  ZNSAddressResolver,
  ZNSDomainToken,
  ZNSRegistrar,
  ZNSPriceOracle,
  ZNSRegistry,
  ZNSTreasury,
  ZeroTokenMock,
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
  maxRootDomainPrice : BigNumber;
  minRootDomainPrice : BigNumber;
  maxSubdomainPrice : BigNumber;
  minSubdomainPrice : BigNumber;
  maxRootDomainLength : BigNumber;
  baseRootDomainLength : BigNumber;
  maxSubdomainLength : BigNumber;
  baseSubdomainLength : BigNumber;
  priceMultiplier : BigNumber;
}

export interface RegistrarConfig {
  treasury : ZNSTreasury;
  registryAddress : string;
  domainTokenAddress : string;
  addressResolverAddress : string;
}

export interface ZNSRegistryProxy {
  proxy : ZNSRegistry;
  impl : ZNSRegistry;
}

export interface ZNSDomainTokenProxy {
  proxy : ZNSDomainToken;
  impl : ZNSDomainToken;
}

export interface ZNSAddressResolverProxy {
  proxy : ZNSAddressResolver;
  impl : ZNSAddressResolver;
}

export interface ZNSPriceOracleProxy {
  proxy : ZNSPriceOracle;
  impl : ZNSPriceOracle;
}

export interface ZNSTreasuryProxy {
  proxy : ZNSTreasury;
  impl : ZNSTreasury;
}

export interface ZNSRegistrarProxy {
  proxy : ZNSRegistrar;
  impl : ZNSRegistrar;
}

export interface ZNSContracts {
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  zeroToken : ZeroTokenMock; // TODO fix when real token
  addressResolver : ZNSAddressResolver;
  priceOracle : ZNSPriceOracle;
  treasury : ZNSTreasury;
  registrar : ZNSRegistrar;
}

export interface ZNSContractsProxy {
  accessController : {
    proxy : null;
    impl : ZNSAccessController;
  };
  registry : ZNSRegistryProxy;
  domainToken : ZNSDomainTokenProxy;
  zeroToken : {
    proxy : null;
    impl : ZeroTokenMock;
  }; // TODO fix when real token
  addressResolver : ZNSAddressResolverProxy;
  priceOracle : ZNSPriceOracleProxy;
  treasury : ZNSTreasuryProxy;
  registrar : ZNSRegistrarProxy;
}

export interface DeployZNSParams {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  priceConfig ?: PriceParams;
  registrationFeePerc ?: BigNumber;
  zeroVaultAddress ?: string;
}