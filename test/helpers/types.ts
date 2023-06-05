import { BigNumber } from "ethers";
import {
  ZNSAddressResolver,
  ZNSDomainToken,
  ZNSEthRegistrar,
  ZNSPriceOracle,
  ZNSRegistry,
  ZNSTreasury,
  ZeroTokenMock,
  ZNSAccessController,
  ZNSEthRegistrarUpgradeMock,
  ZNSPriceOracleUpgradeMock,
  ZNSAddressResolverUpgradeMock,
  ZNSDomainTokenUpgradeMock,
  ZNSRegistryUpgradeMock,
  ZNSTreasuryUpgradeMock,
  ZNSAddressResolverUpgradeMock__factory,
  ZNSDomainTokenUpgradeMock__factory,
  ZNSEthRegistrarUpgradeMock__factory,
  ZNSPriceOracleUpgradeMock__factory,
  ZNSRegistryUpgradeMock__factory,
  ZNSTreasuryUpgradeMock__factory,
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export type Maybe<T> = T | undefined;

export type GetterFunction = Promise<string | boolean | BigNumber | Array<BigNumber>>;

export type ZNSContractMockFactory =
  ZNSEthRegistrarUpgradeMock__factory |
  ZNSPriceOracleUpgradeMock__factory |
  ZNSTreasuryUpgradeMock__factory |
  ZNSRegistryUpgradeMock__factory |
  ZNSAddressResolverUpgradeMock__factory |
  ZNSDomainTokenUpgradeMock__factory;

export type ZNSContractMock =
  ZNSEthRegistrarUpgradeMock |
  ZNSPriceOracleUpgradeMock |
  ZNSTreasuryUpgradeMock |
  ZNSRegistryUpgradeMock |
  ZNSAddressResolverUpgradeMock |
  ZNSDomainTokenUpgradeMock;

export type ZNSContract =
  ZNSEthRegistrar |
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

export interface ZNSContracts {
  accessController : ZNSAccessController;
  addressResolver : ZNSAddressResolver;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  zeroToken : ZeroTokenMock; // TODO fix when real token
  treasury : ZNSTreasury;
  priceOracle : ZNSPriceOracle;
  registrar : ZNSEthRegistrar;
}

export interface DeployZNSParams {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  priceConfig ?: PriceParams;
  registrationFeePerc ?: BigNumber;
  zeroVaultAddress ?: string;
}