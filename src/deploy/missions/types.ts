import { BaseDeployMission } from "./base-deploy-mission";
import { DeployCampaign } from "../campaign/deploy-campaign";
import { IDeployCampaignConfig } from "../campaign/types";


export interface IDeployMissionArgs {
  campaign : DeployCampaign;
  logger : Console;
  config : IDeployCampaignConfig;
}

export type TDeployMissionCtor = new (args : IDeployMissionArgs) => BaseDeployMission;

export interface IContractDbObject {
  address : string;
  abi : string;
  bytecode : string;
  args : string;
  date : string;
}

export type TDeployArgs = Array<string | Array<string>>;

export type TProxyKind = "uups" | "transparent" | "beacon" | undefined;

export interface IProxyData {
  isProxy : boolean;
  proxyKind ?: TProxyKind;
}
