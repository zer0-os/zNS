import { BaseDeployMission } from "./base-deploy-mission";
import { DeployCampaign } from "../campaign/deploy-campaign";
import { IDeployCampaignConfig } from "../campaign/types";


export interface IDeployMissionArgs {
  campaign : DeployCampaign;
  logger : Console;
  config : IDeployCampaignConfig;
}

export type DeployMissionCtor = new (args : IDeployMissionArgs) => BaseDeployMission;

export interface IContractDbObject {
  address : string;
  abi : string;
  bytecode : string;
  args : string;
  date : string;
}

export type DeployArgs = Array<string | Array<string>>;

export type ProxyKind = "uups" | "transparent" | "beacon" | undefined;

export interface IProxyData {
  isProxy : boolean;
  proxyKind ?: ProxyKind;
}
