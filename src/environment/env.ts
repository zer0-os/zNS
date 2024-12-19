// TODO multi: create a proper big ENV file with all default values here
//  and make it be the default for all the tests and so it's easier to fill, clear
//  and override it when needed.

// These are DEFAULT values for local testing that can be overridden by ENV vars
// set in .env file locally.
// For detailed breakdown of vars, see env.sample file.
// !!! --< DO NOT WRITE ANY MAINNET DATA HERE >-- !!!
import { IZNSEnvironment } from "./types";


export const environment : IZNSEnvironment = {
  ENV_LEVEL: "dev",
  CONFIRMATION_N: "0",
  // RPCs for actual networks
  MAINNET_RPC_URL: "",
  SEPOLIA_RPC_URL: "",
  ZCHAIN_TEST_RPC_URL: "",
  ZCHAIN_MAIN_RPC_URL: "",
  // MongoDB setup
  // TODO multi: should we split these into 2 for L1 and L2 ZNS contracts ??
  //  how do we structure the DB here ??
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
  MOCK_Z_TOKEN: "true",
  STAKING_TOKEN_ADDRESS: "",
  // CurvePricer Config [without decimals!]
  // TODO multi: check defaults for the new formula and update !!!
  MAX_PRICE: "25000",
  CURVE_MULTIPLIER: "1000",
  MAX_LENGTH: "50",
  BASE_LENGTH: "4",
  PROTOCOL_FEE_PERC: "222",
  DECIMALS: "18",
  PRECISION: "2",
  // DomainToken Config
  DOMAIN_TOKEN_NAME: "ZERO ID",
  DOMAIN_TOKEN_SYMBOL: "ZID",
  ROYALTY_FRACTION: "200",
  ROYALTY_RECEIVER: "",
  // Vault for all protocol fees
  ZERO_VAULT_ADDRESS: "",
  // Cross-Chain Config
  SRC_CHAIN_NAME: "ethereum",
  MOCK_ZKEVM_BRIDGE: "true",
  ZK_EVM_BRIDGE: "",
  NETWORK_ID: "0",
  BRIDGE_TOKEN: "0x0000000000000000000000000000000000000000",
  DEST_NETWORK_ID: "1",
  // TODO multi: should we use existing constants here or make constants from this file ??
  //  maybe the former so we can modify this file locally without affecting default constants...
  DEST_CHAIN_NAME: "zchain",
  DEST_CHAIN_ID: "2012605151",
  SRC_ZNS_PORTAL: "",
};
