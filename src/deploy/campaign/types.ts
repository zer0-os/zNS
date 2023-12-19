import { BaseDeployMission } from "../missions/base-deploy-mission";
import { BaseContract } from "ethers";
import { ICurvePriceConfig, TDeployMissionCtor } from "../missions/types";
import { HardhatDeployer } from "../deployer/hardhat-deployer";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSContracts } from "../../../test/helpers/types";
import { Logger as WinstonLogger } from "winston";
import { MongoDBAdapter } from "../db/mongo-adapter/mongo-adapter";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";

export type ContractV6 = BaseContract & Omit<BaseContract, keyof BaseContract>;

export interface IDeployCampaignConfig {
  env : string;
  deployAdmin : HardhatEthersSigner | DefenderRelaySigner;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  domainToken : {
    name : string;
    symbol : string;
    defaultRoyaltyReceiver : string;
    defaultRoyaltyFraction : bigint;
  };
  rootPriceConfig : ICurvePriceConfig;
  zeroVaultAddress : string;
  mockMeowToken : boolean;
  stakingTokenAddress : string;
  postDeploy : {
    tenderlyProjectSlug : string;
    monitorContracts : boolean;
    verifyContracts : boolean;
  };
}

export type TLogger = WinstonLogger | Console;

export interface IContractState {
  [key : string] : ContractV6;
}

export interface IMissionInstances {
  [key : string] : BaseDeployMission;
}

export interface ICampaignState {
  missions : Array<TDeployMissionCtor>;
  instances : IMissionInstances;
  contracts : TZNSContractState;
}

export interface ICampaignArgs {
  missions : Array<TDeployMissionCtor>;
  deployer : HardhatDeployer;
  dbAdapter : MongoDBAdapter;
  logger : TLogger;
  config : IDeployCampaignConfig;
}

export type TZNSContractState = IContractState & IZNSContracts;