import { BaseDeployMission } from "../missions/base-deploy-mission";
import { BigNumber, Contract } from "ethers";
import { ICurvePriceConfig, TDeployMissionCtor } from "../missions/types";
import { HardhatDeployer } from "../deployer/hardhat-deployer";
import { BaseStorageAdapter } from "../storage/base-storage-adapter";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IZNSContracts, ZNSContract } from "../../../test/helpers/types";
import { Logger as WinstonLogger } from "winston";


export interface IDeployCampaignConfig {
  deployAdmin : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  domainToken : {
    name : string;
    symbol : string;
    defaultRoyaltyReceiver : string;
    defaultRoyaltyFraction : BigNumber;
  };
  rootPriceConfig : ICurvePriceConfig;
  stakingTokenAddress ?: string;
  zeroVaultAddress : string;
  // TODO dep: add more props when opts expanded
}

export type TLogger = WinstonLogger | Console;

export type IContractState = {
  [key in keyof IZNSContracts as string] : ZNSContract;
};

export interface ICampaignState {
  missions : Array<TDeployMissionCtor>;
  instances : Array<BaseDeployMission>;
  contracts : IContractState;
}

export interface ICampaignArgs {
  missions : Array<TDeployMissionCtor>;
  deployer : HardhatDeployer;
  dbAdapter : BaseStorageAdapter;
  logger : TLogger;
  config : IDeployCampaignConfig;
}
