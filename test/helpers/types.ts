import { BigNumber } from "ethers";

export type Maybe<T> = T | undefined;

export interface PriceOracleConfig {
  rootDomainPrice: BigNumber;
  subdomainPrice: BigNumber;
  priceMultiplier: BigNumber;
  baseLength: number;
  registrarAddress: string;
}