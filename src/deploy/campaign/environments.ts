import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { IDeployCampaignConfig } from "./types";
import {
  DEFAULT_REGISTRATION_FEE_PERCENT,
  DEFAULT_ROYALTY_FRACTION,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
  DEFAULT_DECIMALS,
  DECAULT_PRECISION,
  DEFAULT_PRICE_CONFIG,
  getCurvePrice,
  NO_MOCK_PROD_ERR,
  STAKING_TOKEN_ERR,
  INVALID_CURVE_ERR,
  MONGO_URI_ERR,
  INVALID_ENV_ERR,
} from "../../../test/helpers";
import { ethers } from "ethers";
import { ICurvePriceConfig } from "../missions/types";
import { DEFAULT_MONGO_URI } from "../db/mongo-adapter/constants";
import { MeowMainnet } from "../missions/contracts/meow-token/mainnet-data";

const getCustomAddresses = (
  key : string,
  account : SignerWithAddress,
  accounts ?: Array<string>
) => {
  const addresses = [];

  if (process.env[key]) {
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const decoded = atob(process.env[key]!);

    // Check if there is more than one custom governor
    if (decoded.includes(",")) {
      addresses.push(...decoded.split(","));
    } else {
      addresses.push(decoded);
    }
  }

  if (addresses.length === 0) {
    if (accounts && accounts.length > 0) {
      addresses.push(...accounts); // The user provided custom governors / admins as a param for testing
    } else {
      addresses.push(account.address); // No custom governors / admins provided, use the deployer as the default
    }
  }
  return addresses;
};

// This function builds a config with default values but overrides them with any values that are set
export const getConfig = (
  account : SignerWithAddress,
  zeroVault : SignerWithAddress,
  governors ?: Array<string>,
  admins ?: Array<string>,
) : IDeployCampaignConfig => {
  // Price config variables
  const maxPrice =
    process.env.MAX_PRICE
      ? ethers.parseEther(process.env.MAX_PRICE)
      : DEFAULT_PRICE_CONFIG.maxPrice;

  const minPrice =
    process.env.MIN_PRICE
      ? ethers.parseEther(process.env.MIN_PRICE)
      : DEFAULT_PRICE_CONFIG.minPrice;

  const maxLength =
    process.env.MAX_LENGTH
      ? BigInt(process.env.MAX_LENGTH)
      : DEFAULT_PRICE_CONFIG.maxLength;

  const baseLength =
    process.env.BASE_LENGTH
      ? BigInt(process.env.BASE_LENGTH)
      : DEFAULT_PRICE_CONFIG.baseLength;

  const decimals = process.env.DECIMALS ? BigInt(process.env.DECIMALS) : DEFAULT_DECIMALS;
  const precision = process.env.PRECISION ? BigInt(process.env.PRECISION) : DECAULT_PRECISION;
  const precisionMultiplier = BigInt(10) ** (decimals - precision);

  const feePercentage =
    process.env.REG_FEE_PERCENT
      ? BigInt(process.env.REG_FEE_PERCENT)
      : DEFAULT_REGISTRATION_FEE_PERCENT;
  const royaltyReceiver =
    process.env.ROYALTY_RECEIVER
      ? process.env.ROYALTY_RECEIVER
      : account.address;
  const royaltyFraction =
    process.env.ROYALTY_FRACTION
      ? BigInt(process.env.ROYALTY_FRACTION)
      : DEFAULT_ROYALTY_FRACTION;

  const priceConfig : ICurvePriceConfig = {
    maxPrice,
    minPrice,
    maxLength,
    baseLength,
    precisionMultiplier,
    feePercentage,
    isSet: true,
  };

  // Get governor addresses set through env, if any
  const governorAddresses = getCustomAddresses("GOVERNOR_ADDRESSES", account, governors);

  // Get admin addresses set through env, if any
  const adminAddresses = getCustomAddresses("ADMIN_ADDRESSES", account, admins);

  const config : IDeployCampaignConfig = {
    deployAdmin: account,
    governorAddresses,
    adminAddresses,
    domainToken: {
      name: process.env.TOKEN_NAME ? process.env.TOKEN_NAME : ZNS_DOMAIN_TOKEN_NAME,
      symbol: process.env.TOKEN_SYMBOL ? process.env.TOKEN_SYMBOL : ZNS_DOMAIN_TOKEN_SYMBOL,
      defaultRoyaltyReceiver: royaltyReceiver,
      defaultRoyaltyFraction: royaltyFraction,
    },
    rootPriceConfig: priceConfig,
    zeroVaultAddress: process.env.ZERO_VAULT_ADDRESS ? process.env.ZERO_VAULT_ADDRESS : zeroVault.address,
    mockMeowToken: process.env.MOCK_MEOW_TOKEN ? !!process.env.MOCK_MEOW_TOKEN : true,
    stakingTokenAddress: process.env.STAKING_TOKEN_ADDRESS ? process.env.STAKING_TOKEN_ADDRESS : MeowMainnet.address,
    postDeploy: {
      tenderlyProjectSlug: process.env.TENDERLY_PROJECT_SLUG ? process.env.TENDERLY_PROJECT_SLUG : "",
      monitorContracts: process.env.MONITOR_CONTRACTS === "true",
      verifyContracts: process.env.VERIFY_CONTRACTS === "true",
    },
  };

  // Will throw an error based on any invalid setup, given the `ENV_LEVEL` set
  validate(config);

  return config;
};

// For testing the behaviour when we manipulate, we have an optional "env" string param
export const validate = (
  config : IDeployCampaignConfig,
  env ?: string,
  mongoUri ?: string
) => {
  // Prioritize reading from the env variable first, and only then fallback to the param
  let envLevel = process.env.ENV_LEVEL;

  if (env) {
    // We only ever specify an `env` param in tests
    // So if there is a value we must use that instead
    // otherwise only ever use the ENV_LEVEL above
    envLevel = env;
  }

  if (envLevel === "dev") return; // No validation needed for dev

  if (!mongoUri) mongoUri = process.env.MONGO_URI ? process.env.MONGO_URI : DEFAULT_MONGO_URI;

  // Mainnet or testnet
  if (envLevel === "prod" || envLevel === "test") {
    requires(!config.mockMeowToken, NO_MOCK_PROD_ERR);
    requires(config.stakingTokenAddress === MeowMainnet.address, STAKING_TOKEN_ERR);
    requires(validatePrice(config.rootPriceConfig), INVALID_CURVE_ERR);
    requires(!mongoUri.includes("localhost"), MONGO_URI_ERR);

    if (config.postDeploy.verifyContracts) {
      requires(!!process.env.ETHERSCAN_API_KEY, "Must provide an Etherscan API Key to verify contracts");
    }

    if (config.postDeploy.monitorContracts) {
      requires(!!process.env.TENDERLY_PROJECT_SLUG, "Must provide a Tenderly Project Slug to monitor contracts");
      requires(!!process.env.TENDERLY_ACCOUNT_ID, "Must provide a Tenderly Account ID to monitor contracts");
      requires(!!process.env.TENDERLY_ACCESS_KEY, "Must provide a Tenderly Access Key to monitor contracts");
    }
  }

  // If we reach this code, there is an env variable, but it's not valid.
  throw new Error(INVALID_ENV_ERR);
};

const requires = (condition : boolean, message : string) => {
  if (!condition) {
    throw new Error(message);
  }
};

// No price spike before `minPrice` kicks in at `maxLength`
const validatePrice = (config : ICurvePriceConfig) => {
  const strA = "a".repeat(Number(config.maxLength));
  const strB = "b".repeat(Number(config.maxLength + 1n));

  const priceA = getCurvePrice(strA, config);
  const priceB = getCurvePrice(strB, config);

  // if A < B, then the price spike is invalid
  return !(priceA < priceB);
};
