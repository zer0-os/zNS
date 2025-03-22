import { ZNSRegistryPausable } from "../../typechain";
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
  ZNSRegistryPausable;

export interface IZNSContractsUpgraded {
  [instanceName : string] : ZNSContractUpgraded;
  registry : ZNSRegistryPausable;
}
