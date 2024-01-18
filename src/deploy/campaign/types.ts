import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { ICurvePriceConfig } from "../missions/types";


export type IZNSSigner = HardhatEthersSigner | DefenderRelaySigner;

export interface IDeployCampaignConfig {
  env : string;
  deployAdmin : IZNSSigner;
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
