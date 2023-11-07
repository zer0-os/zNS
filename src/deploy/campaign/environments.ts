// local
// test
// prod

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as hre from "hardhat";

import { IDeployCampaignConfig } from "./types";
import { 
  DEFAULT_ROYALTY_FRACTION, 
  ZNS_DOMAIN_TOKEN_NAME, 
  ZNS_DOMAIN_TOKEN_SYMBOL,
  priceConfigDefault,
} from "../../../test/helpers";
import { ethers } from "ethers";
import { ICurvePriceConfig } from "../missions/types";

// The dev config includes several defaults for easy testing
const devConfig : Partial<IDeployCampaignConfig> = {  
  domainToken: {
    name: ZNS_DOMAIN_TOKEN_NAME,
    symbol: ZNS_DOMAIN_TOKEN_SYMBOL,
    defaultRoyaltyReceiver: "",
    defaultRoyaltyFraction: DEFAULT_ROYALTY_FRACTION,
  },
  rootPriceConfig: priceConfigDefault,
}

async function makeConfig(): Promise<IDeployCampaignConfig> {
  // Private key will be given by HH config file
  const [deployAdmin] = await hre.ethers.getSigners();

  // Price config variables
  const maxPrice = ethers.utils.parseEther(process.env.MAX_PRICE!);
  const minPrice = ethers.utils.parseEther(process.env.MIN_PRICE!);
  const maxLength = ethers.BigNumber.from(process.env.MAX_LENGTH!);
  const baseLength = ethers.BigNumber.from(process.env.BASE_LENGTH!);

  const decimals = ethers.BigNumber.from(process.env.DECIMALS);
  const precision = ethers.BigNumber.from(process.env.PRECISION);
  const precisionMultiplier = ethers.BigNumber.from(10).pow(decimals.sub(precision));
  const feePercentage = ethers.BigNumber.from(process.env.REG_FEE_PERCENT);
  const royaltyFraction = ethers.BigNumber.from(process.env.ROYALTY_FRACTION);

  const priceConfig : ICurvePriceConfig = {
    maxPrice,
    minPrice,
    maxLength,
    baseLength,
    precisionMultiplier,
    feePercentage,
    isSet: true // TODO what should this value be
  }

  const config : IDeployCampaignConfig = {
    deployAdmin: deployAdmin,
    governorAddresses: [process.env.GOVERNOR_ADDRESSES!],
    adminAddresses: [process.env.ADMIN_ADDRESSES!],
    domainToken: {
      name: process.env.TOKEN_NAME!,
      symbol: process.env.TOKEN_SYMBOL!,
      defaultRoyaltyReceiver: process.env.DEFAULT_ROYALTY_RECEIVER!,
      defaultRoyaltyFraction: royaltyFraction
    },
    rootPriceConfig: priceConfig,
    zeroVaultAddress: process.env.ZERO_VAULT_ADDRESS!,
    stakingTokenAddress: process.env.STAKING_TOKEN_ADDRESS,
  }

  return config;
}

export async function getConfig(
  account: SignerWithAddress,
  zeroVault: SignerWithAddress,
  governors?: Array<string>,
  admins?: Array<string>,
): Promise<IDeployCampaignConfig> {
  
  // let config;
  if(process.env.ENV_LEVEL !== "dev") {    
    return await makeConfig();
  }

  const config = devConfig;

  config.deployAdmin = account;
  config.governorAddresses = [account.address]
  config.adminAddresses = [account.address]
  config.zeroVaultAddress = zeroVault.address;

  if (governors) {
    config.governorAddresses.push(...governors);
  }

  if (admins) {
    config.adminAddresses.push(...admins);
  }

  return config as IDeployCampaignConfig;
}