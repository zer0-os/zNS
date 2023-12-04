import { BaseDeployMission } from "../missions/base-deploy-mission";
import { BigNumber, Contract } from "ethers";
import { ICurvePriceConfig, TDeployMissionCtor } from "../missions/types";
import { HardhatDeployer } from "../deployer/hardhat-deployer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IZNSContracts } from "../../../test/helpers/types";
import { Logger as WinstonLogger } from "winston";
import { MongoDBAdapter } from "../db/mongo-adapter/mongo-adapter";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";


export interface IDeployCampaignConfig {
  deployAdmin : SignerWithAddress | DefenderRelaySigner;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  domainToken : {
    name : string;
    symbol : string;
    defaultRoyaltyReceiver : string;
    defaultRoyaltyFraction : BigNumber;
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
  [key : string] : Contract;
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