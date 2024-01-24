import { HardhatEthersSigner, SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { ICurvePriceConfig } from "../missions/types";
import { IDeployCampaignConfig } from "@zero-tech/zdc";


export type IZNSSigner = HardhatEthersSigner | DefenderRelaySigner | SignerWithAddress;

export interface IZNSCampaignConfig <Signer> extends IDeployCampaignConfig<Signer> {
  env : string;
  deployAdmin : Signer;
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
