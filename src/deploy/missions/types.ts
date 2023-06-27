import { BaseDeployMission } from "./base-deploy-mission";


export type DeployMissionCtor = new (args : object) => BaseDeployMission;

export interface IContractDbObject {
  address : string;
  abi : string;
  bytecode : string;
  args : string;
  date : string;
}

export type DeployArgs = Array<unknown>;

export type ProxyKind = "uups" | "transparent" | "beacon" | undefined;

export interface IProxyData {
  isProxy : boolean;
  proxyKind ?: ProxyKind;
}
