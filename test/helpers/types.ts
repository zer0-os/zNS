import { BigNumber } from "ethers";

export type Maybe<T> = T | undefined;

export interface PriceOracleConfig {
  rootDomainPrice : BigNumber;
  subdomainPrice : BigNumber;
  priceMultiplier : BigNumber;
  rootDomainBaseLength : number;
  subdomainBaseLength : number;
  registrarAddress : string;
}