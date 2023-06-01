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
  ZNSEthRegistrarMock,
  ZNSPriceOracleMock,
  ZNSAddressResolverMock,
  ZNSDomainTokenMock,
  ZNSRegistryMock,
  ZNSTreasuryMock,
  ZNSAddressResolverMock__factory,
  ZNSDomainTokenMock__factory,
  ZNSEthRegistrarMock__factory,
  ZNSPriceOracleMock__factory,
  ZNSRegistryMock__factory,
  ZNSTreasuryMock__factory,
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export type Maybe<T> = T | undefined;

export type GetterFunction = (Promise<string> | Promise<boolean> | Promise<BigNumber>);

export type ZNSContractMockFactory =
  ZNSEthRegistrarMock__factory |
  ZNSPriceOracleMock__factory |
  ZNSTreasuryMock__factory |
  ZNSRegistryMock__factory |
  ZNSAddressResolverMock__factory |
  ZNSDomainTokenMock__factory;

export type ZNSContract =
  ZNSEthRegistrar |
  ZNSPriceOracle |
  ZNSTreasury |
  ZNSRegistry |
  ZNSAddressResolver |
  ZNSDomainToken;

export type ZNSContractMock =
  ZNSEthRegistrarMock |
  ZNSPriceOracleMock |
  ZNSTreasuryMock |
  ZNSRegistryMock |
  ZNSAddressResolverMock |
  ZNSDomainTokenMock;

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