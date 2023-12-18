import { BaseDeployMission } from "./base-deploy-mission";
import { DeployCampaign } from "../campaign/deploy-campaign";
import { IDeployCampaignConfig, TLogger } from "../campaign/types";


export interface IDeployMissionArgs {
  campaign : DeployCampaign;
  logger : TLogger;
  config : IDeployCampaignConfig;
}

export type TDeployMissionCtor = new (args : IDeployMissionArgs) => BaseDeployMission;

export type TDeployArg = string | Array<string> | bigint | ICurvePriceConfig;

export type TDeployArgs = Array<TDeployArg>;

export type TProxyKind = "uups" | "transparent" | "beacon" | undefined;

export interface ITenderlyContractData {
  display_name : string;
  address : string;
  network_id : string;
}

export interface IProxyKinds {
  uups : TProxyKind;
  transparent : TProxyKind;
  beacon : TProxyKind;
}

export interface IProxyData {
  isProxy : boolean;
  kind ?: TProxyKind;
}

export interface ICurvePriceConfig {
  maxPrice : bigint;
  minPrice : bigint;
  maxLength : bigint;
  baseLength : bigint;
  precisionMultiplier : bigint;
  feePercentage : bigint;
  isSet : boolean;
}
