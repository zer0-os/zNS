import { BigNumber } from "ethers";
import { ZNSTreasury } from "../../typechain";

export type Maybe<T> = T | undefined;

export interface PriceOracleConfig {
  rootDomainPrice : BigNumber;
  subdomainPrice : BigNumber;
  priceMultiplier : BigNumber;
  rootDomainBaseLength : number;
  subdomainBaseLength : number;
  registrarAddress : string;
}

export interface RegistrarConfig {
  treasury: ZNSTreasury;
  registryAddress: string;
  domainTokenAddress: string;
  addressResolverAddress: string;
}