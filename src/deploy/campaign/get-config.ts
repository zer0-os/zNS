import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig } from "./types";
import {
  DEFAULT_PROTOCOL_FEE_PERCENT,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
  DEFAULT_DECIMALS,
  DEFAULT_PRECISION,
  DEFAULT_PRICE_CONFIG,
  NO_MOCK_PROD_ERR,
  STAKING_TOKEN_ERR,
  INVALID_CURVE_ERR,
  MONGO_URI_ERR,
  INVALID_ENV_ERR, NO_ZERO_VAULT_ERR,
} from "../../../test/helpers";
import { ethers } from "ethers";
import { ICurvePriceConfig } from "../missions/types";
import { MEOWzChainData } from "../missions/contracts/meow-token/mainnet-data";
import { EnvironmentLevels, TEnvironment } from "@zero-tech/zdc";
import { findMissingEnvVars } from "../../environment/validate";
import { SupportedChains } from "../constants";


const getCustomAddresses = (
  key : string,
  deployerAddress : string,
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

  if (accounts && accounts.length > 0) {
    addresses.push(...accounts); // The user provided custom governors / admins as a param for testing
  }

  if (!accounts || accounts.length === 0 || process.env.ENV_LEVEL === EnvironmentLevels.dev) {
    // No custom governors / admins provided, use the deployer as the default
    addresses.push(deployerAddress);
  }

  return addresses;
};

// This function builds a config with default values but overrides them with any values that are set
export const getConfig = async ({
  deployer,
  governors,
  admins,
  zeroVaultAddress,
  env, // this is ONLY used for tests!
} : {
  deployer : SignerWithAddress;
  governors ?: Array<string>;
  admins ?: Array<string>;
  zeroVaultAddress ?: string;
  env ?: TEnvironment;
}) : Promise<IZNSCampaignConfig> => {
  // Will throw an error based on any invalid setup, given the `ENV_LEVEL` set
  const priceConfig = validateEnv(env);

  let deployerAddress;
  if (deployer && Object.keys(deployer).includes("address")) {
    deployerAddress = deployer.address;
  } else {
    deployerAddress = await deployer.getAddress();
  }

  let zeroVaultAddressConf;

  if (process.env.ENV_LEVEL === EnvironmentLevels.dev) {
    if (!zeroVaultAddress && !process.env.ZERO_VAULT_ADDRESS) {
      zeroVaultAddressConf = deployerAddress;
    } else {
      zeroVaultAddressConf = zeroVaultAddress || process.env.ZERO_VAULT_ADDRESS;
    }
  } else {
    zeroVaultAddressConf = process.env.ZERO_VAULT_ADDRESS;
  }

  // Domain Token Values
  const royaltyReceiver = process.env.ENV_LEVEL !== EnvironmentLevels.dev
    ? process.env.ROYALTY_RECEIVER
    : zeroVaultAddressConf;

  const royaltyFraction = BigInt(process.env.ROYALTY_FRACTION);

  // Get governor addresses set through env, if any
  const governorAddresses = getCustomAddresses("GOVERNOR_ADDRESSES", deployerAddress, governors);

  // Get admin addresses set through env, if any
  const adminAddresses = getCustomAddresses("ADMIN_ADDRESSES", deployerAddress, admins);

  const config : IZNSCampaignConfig = {
    env: process.env.ENV_LEVEL,
    confirmationsN: Number(process.env.CONFIRMATION_N),
    srcChainName: SupportedChains.z, // should be sepolia
    deployAdmin: deployer,
    governorAddresses,
    adminAddresses,
    domainToken: {
      name: process.env.DOMAIN_TOKEN_NAME ? process.env.DOMAIN_TOKEN_NAME : ZNS_DOMAIN_TOKEN_NAME,
      symbol: process.env.DOMAIN_TOKEN_SYMBOL ? process.env.DOMAIN_TOKEN_SYMBOL : ZNS_DOMAIN_TOKEN_SYMBOL,
      defaultRoyaltyReceiver: royaltyReceiver as string,
      defaultRoyaltyFraction: royaltyFraction,
    },
    rootPriceConfig: priceConfig,
    zeroVaultAddress: zeroVaultAddressConf as string,
    mockMeowToken: process.env.MOCK_MEOW_TOKEN === "true",
    stakingTokenAddress: process.env.STAKING_TOKEN_ADDRESS,
    postDeploy: {
      tenderlyProjectSlug: process.env.TENDERLY_PROJECT_SLUG || "",
      monitorContracts: process.env.MONITOR_CONTRACTS === "true",
      verifyContracts: process.env.VERIFY_CONTRACTS === "true",
    },
  };

  return config;
};

// For testing the behaviour when we manipulate, we have an optional "env" string param
export const validateEnv = (
  env ?: TEnvironment, // this is ONLY used for tests!
) : ICurvePriceConfig => {
  // Prioritize reading from the env variable first, and only then fallback to the param
  let envLevel = process.env.ENV_LEVEL;

  if (env) {
    // We only ever specify an `env` param in tests
    // So if there is a value we must use that instead
    // otherwise only ever use the ENV_LEVEL above
    envLevel = env;
  }

  // TODO doesnt seem to work on windows?
  findMissingEnvVars();

  // Validate price config first since we have to return it
  const priceConfig = getValidateRootPriceConfig();

  if (envLevel === EnvironmentLevels.dev) return priceConfig;

  if (envLevel === EnvironmentLevels.test || envLevel === EnvironmentLevels.dev) {
    if (process.env.MOCK_MEOW_TOKEN === "false" && !process.env.STAKING_TOKEN_ADDRESS) {
      throw new Error("Must provide a staking token address if not mocking MEOW token in `dev` environment");
    }
  }

  if (envLevel !== EnvironmentLevels.test && envLevel !== EnvironmentLevels.prod) {
    // If we reach this code, there is an env variable, but it's not valid.
    throw new Error(INVALID_ENV_ERR);
  }

  if (!process.env.ROYALTY_RECEIVER) {
    throw new Error("Must provide a default royalty receiver");
  }

  if (!process.env.ROYALTY_FRACTION) {
    throw new Error("Must provide a default royalty fraction");
  }

  if (!process.env.MONGO_DB_URI) {
    throw new Error(`Must provide a Mongo URI used for ${envLevel} environment!`);
  }

  requires(!!process.env.ZERO_VAULT_ADDRESS, NO_ZERO_VAULT_ERR);

  // Mainnet
  if (envLevel === EnvironmentLevels.test) {
    requires(process.env.MOCK_MEOW_TOKEN === "false", NO_MOCK_PROD_ERR);
    requires(process.env.STAKING_TOKEN_ADDRESS === MEOWzChainData.address, STAKING_TOKEN_ERR);
    requires(!process.env.MONGO_DB_URI.includes("localhost"), MONGO_URI_ERR);
  }

  if (process.env.VERIFY_CONTRACTS === "true") {
    requires(!!process.env.ETHERSCAN_API_KEY, "Must provide an Etherscan API Key to verify contracts");
  }

  if (process.env.MONITOR_CONTRACTS === "true") {
    requires(!!process.env.TENDERLY_PROJECT_SLUG, "Must provide a Tenderly Project Slug to monitor contracts");
    requires(!!process.env.TENDERLY_ACCOUNT_ID, "Must provide a Tenderly Account ID to monitor contracts");
    requires(!!process.env.TENDERLY_ACCESS_KEY, "Must provide a Tenderly Access Key to monitor contracts");
  }

  return priceConfig;
};

const getValidateRootPriceConfig = () => {

  if (process.env.ENV_LEVEL === EnvironmentLevels.test) {
    requires(
      !!process.env.MAX_PRICE
      && !!process.env.CURVE_MULTIPLIER
      && !!process.env.MAX_LENGTH
      && !!process.env.BASE_LENGTH
      && !!process.env.DECIMALS
      && !!process.env.PRECISION
      && !!process.env.PROTOCOL_FEE_PERC,
      "Must provide all price config variables for prod environment!"
    );
  }

  // Price config variables
  const maxPrice =
    process.env.MAX_PRICE
      ? ethers.parseEther(process.env.MAX_PRICE)
      : DEFAULT_PRICE_CONFIG.maxPrice;

  const curveMultiplier =
    process.env.CURVE_MULTIPLIER
      ? BigInt(process.env.CURVE_MULTIPLIER)
      : DEFAULT_PRICE_CONFIG.curveMultiplier;

  const maxLength =
    process.env.MAX_LENGTH
      ? BigInt(process.env.MAX_LENGTH)
      : DEFAULT_PRICE_CONFIG.maxLength;

  const baseLength =
    process.env.BASE_LENGTH
      ? BigInt(process.env.BASE_LENGTH)
      : DEFAULT_PRICE_CONFIG.baseLength;

  const decimals = process.env.DECIMALS ? BigInt(process.env.DECIMALS) : DEFAULT_DECIMALS;
  const precision = process.env.PRECISION ? BigInt(process.env.PRECISION) : DEFAULT_PRECISION;
  const precisionMultiplier = BigInt(10) ** (decimals - precision);

  const feePercentage =
    process.env.PROTOCOL_FEE_PERC
      ? BigInt(process.env.PROTOCOL_FEE_PERC)
      : DEFAULT_PROTOCOL_FEE_PERCENT;

  const priceConfig : ICurvePriceConfig = {
    maxPrice,
    curveMultiplier,
    maxLength,
    baseLength,
    precisionMultiplier,
    feePercentage,
    isSet: true,
  };

  validateConfig(priceConfig);

  return priceConfig;
};

const requires = (condition : boolean, message : string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const validateConfig = (config : ICurvePriceConfig) => {
  const PERCENTAGE_BASIS = 10000n;

  if (
    (config.curveMultiplier === 0n && config.baseLength === 0n) ||
    (config.maxLength < config.baseLength) ||
    ((config.maxLength < config.baseLength) || config.maxLength === 0n) ||
    (config.curveMultiplier === 0n || config.curveMultiplier > 10n**18n) ||
    (config.feePercentage > PERCENTAGE_BASIS)
  ) {
    requires(false, INVALID_CURVE_ERR);
  }
};
