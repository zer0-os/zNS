import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import {
  IZNSCampaignConfig,
  IZNSEthCrossConfig,
  IZNSZChainCrossConfig,
  TZNSCrossConfig,
} from "./types";
import {
  DEFAULT_DECIMALS,
  DEFAULT_PRECISION,
  getCurvePrice,
  DEFAULT_PRICE_CONFIG,
  NO_MOCK_PROD_ERR,
  STAKING_TOKEN_ERR,
  INVALID_CURVE_ERR,
  MONGO_URI_ERR,
  INVALID_ENV_ERR, NO_ZERO_VAULT_ERR,
  INITIAL_ADMIN_DELAY_DEFAULT,
  INITIAL_SUPPLY_DEFAULT,
  INFLATION_RATES_DEFAULT,
  FINAL_INFLATION_RATE_DEFAULT,
  Z_NAME_DEFAULT,
  Z_SYMBOL_DEFAULT,
} from "../../../test/helpers";
import { ethers, Wallet } from "ethers";
import { MeowMainnet } from "../missions/contracts/zns-base/meow-token/mainnet-data";
import { TSupportedChain } from "../missions/contracts/cross-chain/portals/types";
import { SupportedChains } from "../missions/contracts/cross-chain/portals/get-portal-dm";
import { findMissingEnvVars } from "../../environment/validate";
import { ICurvePriceConfig, IZTokenConfig } from "../missions/types";
import process from "process";
import { ZSepolia } from "../missions/contracts/z-token/mainnet-data";


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

  if (!addresses.includes(deployerAddress)) {
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
  zTokenConfig,
} : {
  deployer : Wallet | SignerWithAddress;
  governors ?: Array<string>;
  admins ?: Array<string>;
  zeroVaultAddress ?: string;
  env ?: string;
  zTokenConfig ?: IZTokenConfig;
}) : Promise<IZNSCampaignConfig<SignerWithAddress | Wallet>> => {
  // Will throw an error based on any invalid setup, given the `ENV_LEVEL` set
  const priceConfig = validateEnv(env);

  let deployerAddress;
  if (deployer && Object.keys(deployer).includes("address")) {
    deployerAddress = deployer.address;
  } else {
    deployerAddress = await deployer.getAddress();
  }

  let zeroVaultAddressConf : string;

  const zeroVaultAddressEnv = process.env.ZERO_VAULT_ADDRESS;
  const mockZTokenEnv = process.env.MOCK_Z_TOKEN;
  const envLevel = process.env.ENV_LEVEL;

  // Get governor addresses set through env, if any
  const governorAddresses = getCustomAddresses("GOVERNOR_ADDRESSES", deployerAddress, governors);
  // Get admin addresses set through env, if any
  const adminAddresses = getCustomAddresses("ADMIN_ADDRESSES", deployerAddress, admins);

  let zConfig : IZTokenConfig | undefined;

  if (envLevel === "dev") {
    requires(
      !!zeroVaultAddress || !!zeroVaultAddressEnv,
      "Must pass `zeroVaultAddress` to `getConfig()` for `dev` environment"
    );
    zeroVaultAddressConf = zeroVaultAddress || zeroVaultAddressEnv;

    if (!zTokenConfig) {
      // in case, we didn't provide addresses, it will choose the governon as `admin` argument,
      // deployAdmin as `minter` and first passed admin as `mintBeneficiary`.
      zConfig = {
        name: Z_NAME_DEFAULT,
        symbol: Z_SYMBOL_DEFAULT,
        defaultAdmin: governorAddresses[0],
        initialAdminDelay: INITIAL_ADMIN_DELAY_DEFAULT,
        minter: deployer.address,
        mintBeneficiary: adminAddresses[0],
        initialSupplyBase: INITIAL_SUPPLY_DEFAULT,
        inflationRates: INFLATION_RATES_DEFAULT,
        finalInflationRate: FINAL_INFLATION_RATE_DEFAULT,
      };
    } else {
    zeroVaultAddressConf = zeroVaultAddressEnv;
  }

  // Domain Token Values
  const royaltyReceiver = envLevel !== "dev" ? process.env.ROYALTY_RECEIVER! : zeroVaultAddressConf;
  const royaltyFraction =
    process.env.ROYALTY_FRACTION
      ? BigInt(process.env.ROYALTY_FRACTION)
      : DEFAULT_ROYALTY_FRACTION;

  const config : IZNSCampaignConfig<SignerWithAddress> = {
    env: envLevel!,
    deployAdmin: deployer,
    governorAddresses,
    adminAddresses,
    domainToken: {
      name: process.env.DOMAIN_TOKEN_NAME,
      symbol: process.env.DOMAIN_TOKEN_SYMBOL,
      defaultRoyaltyReceiver: royaltyReceiver,
      defaultRoyaltyFraction: royaltyFraction,
    },
    rootPriceConfig: priceConfig,
    zTokenConfig: zConfig,
    zeroVaultAddress: zeroVaultAddressConf,
    mockMeowToken: process.env.MOCK_MEOW_TOKEN === "true",
    stakingTokenAddress: process.env.STAKING_TOKEN_ADDRESS,
    postDeploy: {
      tenderlyProjectSlug: process.env.TENDERLY_PROJECT_SLUG ?? "",
      monitorContracts: process.env.MONITOR_CONTRACTS === "true",
      verifyContracts: process.env.VERIFY_CONTRACTS === "true",
    },
    crosschain: buildCrosschainConfig(),
  };

  return config;
};

// For testing the behaviour when we manipulate, we have an optional "env" string param
export const validateEnv = (
  env ?: string, // this is ONLY used for tests!
) : ICurvePriceConfig => {
  // Prioritize reading from the env variable first, and only then fallback to the param
  let envLevel = process.env.ENV_LEVEL;

  if (env) {
    // We only ever specify an `env` param in tests
    // So if there is a value we must use that instead
    // otherwise only ever use the ENV_LEVEL above
    envLevel = env;
  }

  findMissingEnvVars();

  // Validate price config first since we have to return it
  const priceConfig = getValidateRootPriceConfig();

  const mockZTokenEnv = process.env.MOCK_Z_TOKEN;

  if (envLevel === "dev") return priceConfig;

  if (envLevel === "test" || envLevel === "dev") {
    if (mockZTokenEnv === "false" && !process.env.STAKING_TOKEN_ADDRESS) {
      throw new Error("Must provide a staking token address if not mocking Z token in `dev` environment");
    }
  }

  if (envLevel !== "test" && envLevel !== "prod") {
    // If we reach this code, there is an env variable, but it's not valid.
    throw new Error(INVALID_ENV_ERR);
  }

  // Mainnet
  if (envLevel === "prod") {
    requires(!process.env.MONGO_DB_URI.includes("localhost"), MONGO_URI_ERR);
    requires(mockZTokenEnv === "false", NO_MOCK_PROD_ERR);
    requires(process.env.STAKING_TOKEN_ADDRESS === ZSepolia.address, STAKING_TOKEN_ERR);
  }

  if (process.env.VERIFY_CONTRACTS === "true") {
    requires(process.env.ETHERSCAN_API_KEY === "true", "Must provide an Etherscan API Key to verify contracts");
  }

  if (process.env.MONITOR_CONTRACTS === "true") {
    requires(process.env.TENDERLY_PROJECT_SLUG === "true", "Must provide a Tenderly Project Slug to monitor contracts");
    requires(process.env.TENDERLY_ACCOUNT_ID === "true", "Must provide a Tenderly Account ID to monitor contracts");
    requires(process.env.TENDERLY_ACCESS_KEY === "true", "Must provide a Tenderly Access Key to monitor contracts");
  }

  return priceConfig;
};

export const getValidateRootPriceConfig = () => {
  // Price config variables
  const decimals = process.env.DECIMALS ? BigInt(process.env.DECIMALS) : DEFAULT_DECIMALS;
  const precision = process.env.PRECISION ? BigInt(process.env.PRECISION) : DEFAULT_PRECISION;
  const precisionMultiplier = BigInt(10) ** (decimals - precision);

  const priceConfig : ICurvePriceConfig = {
    maxPrice: ethers.parseEther(process.env.MAX_PRICE),
    curveMultiplier: BigInt(process.env.CURVE_MULTIPLIER),
    maxLength: BigInt(process.env.MAX_LENGTH),
    baseLength: BigInt(process.env.BASE_LENGTH),
    precisionMultiplier,
    feePercentage: BigInt(process.env.PROTOCOL_FEE_PERC),
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

export const buildCrosschainConfig = () : TZNSCrossConfig => {
  const srcChainName = process.env.SRC_CHAIN_NAME as TSupportedChain;
  const mockZkEvmBridge = process.env.MOCK_ZKEVM_BRIDGE === "true";

  let curNetworkId;
  let zkEvmBridgeAddress;
  if (!mockZkEvmBridge) {
    requires(
      !!process.env.ZK_EVM_BRIDGE,
      "Must provide source zkEVM bridge address from this chain if not mocking!"
    );
    zkEvmBridgeAddress = process.env.ZK_EVM_BRIDGE;
  } else {
    requires(
      !!process.env.NETWORK_ID,
      "Must provide current network ID for mocked bridge!"
    );
    curNetworkId = BigInt(process.env.NETWORK_ID);
  }

  const baseConfig = {
    mockZkEvmBridge,
    srcChainName,
    zkEvmBridgeAddress,
    curNetworkId,
    bridgeToken: process.env.BRIDGE_TOKEN,
  };

  let crossConfig;
  switch (srcChainName) {
  case SupportedChains.eth:
    requires(!!process.env.DEST_NETWORK_ID, "Must provide destination network ID!");
    requires(!!process.env.DEST_CHAIN_NAME, "Must provide destination chain name!");
    requires(!!process.env.DEST_CHAIN_ID, "Must provide destination chain ID!");

    crossConfig = {
      ...baseConfig,
      destNetworkId: BigInt(process.env.DEST_NETWORK_ID),
      destChainName: process.env.DEST_CHAIN_NAME,
      destChainId: BigInt(process.env.DEST_CHAIN_ID),
    } as IZNSEthCrossConfig;

    break;
  case SupportedChains.z:
    requires(!!process.env.SRC_ZNS_PORTAL, "Must provide source ZNSZChainPortal address!");

    crossConfig = {
      ...baseConfig,
      srcZnsPortal: process.env.SRC_ZNS_PORTAL,
    } as IZNSZChainCrossConfig;

    break;
  default:
    throw new Error(`Unsupported chain: ${srcChainName}!`);
  }

  return crossConfig;
};
