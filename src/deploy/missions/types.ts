import { BaseDeployMission } from "./base-deploy-mission";
import { DeployCampaign } from "../campaign/deploy-campaign";
import { IDeployCampaignConfig } from "../campaign/types";
import { BigNumber } from "ethers";


export interface IDeployMissionArgs {
  campaign : DeployCampaign;
  logger : Logger;
  config : IDeployCampaignConfig;
}

export type TDeployMissionCtor = new (args : IDeployMissionArgs) => BaseDeployMission;

export interface IContractDbObject {
  address : string;
  abi : string;
  bytecode : string;
  args : string;
  implementation : string | null;
  version : string;
}

export type TDeployArgs = Array<string | Array<string>>;

export type TProxyKind = "uups" | "transparent" | "beacon" | undefined;

export interface IProxyData {
  isProxy : boolean;
  proxyKind ?: TProxyKind;
}

export interface IPriceParams {
  maxPrice : BigNumber;
  minPrice : BigNumber;
  maxLength : BigNumber;
  baseLength : BigNumber;
  priceMultiplier : BigNumber;
  precisionMultiplier : BigNumber;
}
