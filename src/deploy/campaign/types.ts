import { BaseDeployMission } from "../missions/base-deploy-mission";
import { BigNumber, Contract } from "ethers";
import { ICurvePriceConfig, TDeployMissionCtor } from "../missions/types";
import { HardhatDeployer } from "../deployer/hardhat-deployer";
import { BaseStorageAdapter } from "../storage/base-storage-adapter";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


export interface IDeployCampaignConfig {
  deployAdmin : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  domainToken : {
    name : string;
    symbol : string;
  };
  priceConfig : ICurvePriceConfig;
  registrationFee : BigNumber;
  stakingTokenAddress ?: string;
  zeroVaultAddress : string;
  // TODO dep: add more props when opts expanded
}

export type Logger = Console;

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
  deployer : HardhatDeployer;
  dbAdapter : BaseStorageAdapter;
  logger : Logger;
  config : IDeployCampaignConfig;
}
