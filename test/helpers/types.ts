import { BigNumber } from "ethers";
import { ZNSAddressResolver, ZNSDomainToken, ZNSEthRegistrar, ZNSPriceOracle, ZNSRegistry, ZNSTreasury, ZeroTokenMock } from "../../typechain";

export type Maybe<T> = T | undefined;

export interface PriceParams {
  maxRootDomainPrice : BigNumber;
  minRootDomainPrice : BigNumber;
  maxSubdomainPrice : BigNumber;
  minSubdomainPrice : BigNumber;
  maxRootDomainLength : number;
  baseRootDomainLength : number;
  maxSubdomainLength : number;
  baseSubdomainLength : number;
  priceMultiplier : BigNumber;
}

export interface RegistrarConfig {
  treasury : ZNSTreasury;
  registryAddress : string;
  domainTokenAddress : string;
  addressResolverAddress : string;
  priceOracleAddress : string;
  burnAddress : string; // TODO rename / fix
}

export interface ZNSContracts {
  addressResolver : ZNSAddressResolver;
  registry : ZNSRegistry;
  domainToken : ZNSDomainToken;
  zeroToken : ZeroTokenMock; // TODO fix when real token
  treasury : ZNSTreasury;
  priceOracle : ZNSPriceOracle;
  registrar : ZNSEthRegistrar;
}