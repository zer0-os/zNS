import { BigNumber } from "ethers";
import { ZNSDomainToken, ZNSEthRegistrar, ZNSPriceOracle, ZNSRegistry, ZNSTreasury, ZeroTokenMock } from "../../typechain";

export type Maybe<T> = T | undefined;

export interface PriceOracleConfig {
  rootDomainPrice: BigNumber;
  subdomainPrice: BigNumber;
  priceMultiplier: BigNumber;
  rootDomainBaseLength: number;
  subdomainBaseLength: number;
  registrarAddress: string;
}

export interface RegistrarConfig {
  treasury: ZNSTreasury;
  registryAddress: string;
  domainTokenAddress: string;
  addressResolverAddress: string;
  priceOracleAddress: string;
}

export interface ZNSContracts {
  registry: ZNSRegistry
  domainToken: ZNSDomainToken
  zToken: ZeroTokenMock // TODO fix
  treasury: ZNSTreasury
  priceOracle: ZNSPriceOracle
  registrar: ZNSEthRegistrar
}