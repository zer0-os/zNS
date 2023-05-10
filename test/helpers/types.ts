import { BigNumber } from "ethers";
import {
  ZNSAddressResolver,
  ZNSDomainToken,
  ZNSEthRegistrar,
  ZNSPriceOracle,
  ZNSRegistry,
  ZNSTreasury,
  ZeroTokenMock, ZNSAccessController,
} from "../../typechain";

export type Maybe<T> = T | undefined;

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
  priceOracleAddress : string;
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