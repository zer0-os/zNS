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
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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
}