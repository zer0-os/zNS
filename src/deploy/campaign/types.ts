import { BaseDeployMission } from "../missions/base-deploy-mission";
import { BigNumber, Contract } from "ethers";
import { IPriceParams, TDeployMissionCtor } from "../missions/types";
import { Deployer } from "../deployer/deployer";
import { BaseStorageAdapter } from "../storage/base-storage-adapter";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


export interface IDeployCampaignConfig {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  domainToken : {
    name : string;
    symbol : string;
  };
  priceConfig : IPriceParams;
  registrationFee : BigNumber;
  stakingTokenAddress ?: string;
  zeroVaultAddress : string;
  // TODO dep: add more props when opts expanded
}

export interface IContractState {
  [key : string] : Contract;
}

export interface ICampaignState {
  missions : Array<TDeployMissionCtor>;
  instances : Array<BaseDeployMission>;
  contracts : IContractState;
}

export interface ICampaignArgs {
  missions : Array<TDeployMissionCtor>;
  deployer : Deployer;
  dbAdapter : BaseStorageAdapter;
  logger : Console;
  config : IDeployCampaignConfig;
}
