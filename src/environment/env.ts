// These are DEFAULT values for local testing that can be overridden by ENV vars
// set in .env file locally.
// For detailed breakdown of vars, see env.sample file.
// !!! --< DO NOT WRITE ANY MAINNET DATA HERE >-- !!!
import { IZNSEnvironment } from "./types";
import { PricerTypes } from "../deploy/constants";


export const environment : IZNSEnvironment = {
  ENV_LEVEL: "dev",
  CONFIRMATION_N: "0",
  // RPCs for actual networks
  MAINNET_RPC_URL: "",
  SEPOLIA_RPC_URL: "",
  ZCHAIN_TEST_RPC_URL: "", // Zephyr Testnet
  ZCHAIN_MAIN_RPC_URL: "",
  // Private keys for deployment
  DEPLOY_ADMIN_MAINNET_PK: "",
  DEPLOY_ADMIN_SEPOLIA_PK: "",
  DEPLOY_ADMIN_ZCHAIN_TEST_PK: "",
  DEPLOY_ADMIN_ZCHAIN_MAIN_PK: "",
  // MongoDB setup
  MONGO_DB_URI: `mongodb://localhost:2701${process.argv.includes("coverage") ? "7" : "8"}`,
  MONGO_DB_NAME: "zns-campaign",
  MONGO_DB_CLIENT_OPTS: "",
  MONGO_DB_VERSION: "",
  ARCHIVE_PREVIOUS_DB_VERSION: "true",
  // Logger vars
  LOG_LEVEL: "debug",
  SILENT_LOGGER: "true",
  MAKE_LOG_FILE: "false",
  // 3rd Party Services:
  //  Etherscan
  VERIFY_CONTRACTS: "false",
  ETHERSCAN_API_KEY: "",
  //  Tenderly
  MONITOR_CONTRACTS: "false",
  TENDERLY_ACCOUNT_ID: "zer0-os",
  TENDERLY_PROJECT_SLUG: "",
  TENDERLY_ACCESS_KEY: "",
  //    Tenderly for testing with it's DevNet feature
  TENDERLY_DEVNET_TEMPLATE: "zns-devnet",
  DEVNET_RPC_URL: "",

  // Contracts Config:
  // ! System Administration !
  GOVERNOR_ADDRESSES: "",
  ADMIN_ADDRESSES: "",
  // ZNS Payment Token (e.g. Z)
  MOCK_MEOW_TOKEN: "true",
  STAKING_TOKEN_ADDRESS: "",
  // Pricer Data
  ROOT_PRICER_TYPE: PricerTypes.curve,
  // FixedPricer Config [without decimals!]
  FIXED_PRICE: "",
  FIXED_FEE_PERC: "",
  // CurvePricer Config [without decimals!]
  CURVE_MAX_PRICE: "25000",
  CURVE_MULTIPLIER: "1000",
  CURVE_MAX_LENGTH: "50",
  CURVE_BASE_LENGTH: "4",
  CURVE_PROTOCOL_FEE_PERC: "222",
  CURVE_DECIMALS: "18",
  CURVE_PRECISION: "2",
  // DomainToken Config
  DOMAIN_TOKEN_NAME: "ZERO ID",
  DOMAIN_TOKEN_SYMBOL: "ZID",
  ROYALTY_FRACTION: "200",
  ROYALTY_RECEIVER: "",
  // Vault for all protocol fees
  ZERO_VAULT_ADDRESS: "",
};
