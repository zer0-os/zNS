import { BaseDeployMission } from "../missions/base-deploy-mission";
import { Contract } from "ethers";
import { DeployMissionCtor } from "../missions/types";
import { Deployer } from "../deployer/deployer";


export interface IDeployCampaignConfig {
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  // TODO dep: add more props when opts expanded
}

export interface IContractState {
  [key : string] : Contract;
}

export interface ICampaignState {
  missions : Array<DeployMissionCtor>;
  instances : Array<BaseDeployMission>;
  contracts : IContractState;
}

export interface ICampaignArgs {
  missions : Array<DeployMissionCtor>;
  deployer : Deployer;
  dbAdapter : object;
  logger : Console;
  config : IDeployCampaignConfig;
}
