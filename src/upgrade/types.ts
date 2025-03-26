import {
  ZNSAddressResolverPausable,
  ZNSCurvePricerPausable,
  ZNSDomainTokenPausable, ZNSFixedPricerPausable,
  ZNSRegistryPausable, ZNSRootRegistrarPausable, ZNSSubRegistrarPausable, ZNSTreasuryPausable,
} from "../../typechain";
import { Addressable } from "ethers";

export type ContractStorageData = Array<{
  [label : string] : string | number | Array<object>;
}>;

export interface IContractData {
  contractName : string;
  instanceName : keyof IZNSContractsUpgraded;
  address : string | Addressable;
}

export type ZNSContractUpgraded =
  ZNSRegistryPausable |
  ZNSDomainTokenPausable |
  ZNSAddressResolverPausable |
  ZNSCurvePricerPausable |
  ZNSFixedPricerPausable |
  ZNSTreasuryPausable |
  ZNSRootRegistrarPausable |
  ZNSSubRegistrarPausable;

export interface IZNSContractsUpgraded {
  [instanceName : string] : ZNSContractUpgraded;
  registry : ZNSRegistryPausable;
  domainToken : ZNSDomainTokenPausable;
  addressResolver : ZNSAddressResolverPausable;
  curvePricer : ZNSCurvePricerPausable;
  fixedPricer : ZNSFixedPricerPausable;
  treasury : ZNSTreasuryPausable;
  rootRegistrar : ZNSRootRegistrarPausable;
  subRegistrar : ZNSSubRegistrarPausable;
}
