/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars */
import { mochaGlobalSetup, mochaGlobalTeardown } from "./test/mocha-global";
import { setDefaultEnvironment } from "./src/environment/set-env";

import * as tenderly from "@tenderly/hardhat-tenderly";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-toolbox/network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";
import "solidity-docgen";
import "hardhat-gas-reporter";
import { HardhatUserConfig, subtask } from "hardhat/config";
import { TASK_TEST_RUN_MOCHA_TESTS } from "hardhat/builtin-tasks/task-names";


subtask(TASK_TEST_RUN_MOCHA_TESTS)
  .setAction(async (args, hre, runSuper) => {
    await mochaGlobalSetup();
    const testFailures = await runSuper(args);
    await mochaGlobalTeardown();

    return testFailures;
  });


const placeHolderRpcUrl = "https://placeholder.rpc.url";

/**
 * @description Retrieves private keys from environment variables.
 * @param {string[]} varNames - An array of env var names.
 * @returns {string[]} An array of the private keys that were found.
 */
const getAccounts = (varNames : Array<string>) => {
  if (!varNames) {
    return [];
  }

  return varNames.reduce((accounts : Array<string>, envVarName) => {
    const account = process.env[envVarName];
    if (account) {
      accounts.push(account);
    }
    return accounts;
  }, []);
};

const config : HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 20000,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain",
  },
  mocha: {
    timeout: 5000000,
  },
  gasReporter: {
    enabled: false,
  },
  networks: {
    zephyr: {
      url: process.env.ZEPHYR_RPC_URL || placeHolderRpcUrl,
      chainId: 1417429182,
      accounts: getAccounts([
        "ZNS_DEPLOYER",
        "ZERO_VAULT_KEY",
        "TEST_USER_A_KEY",
        "TEST_USER_B_KEY",
        "TEST_USER_C_KEY",
        "TEST_USER_D_KEY",
        "TEST_USER_E_KEY",
        "TEST_USER_F_KEY",
      ]),
      timeout: 10000000,
      loggingEnabled: true,
    },
    zchain: {
      url: process.env.ZCHAIN_RPC_URL || placeHolderRpcUrl,
      chainId: 9369,
      accounts: getAccounts([
        "ZNS_DEPLOYER",
        "ZERO_VAULT_KEY",
        "TEST_USER_A_KEY",
        "TEST_USER_B_KEY",
        "TEST_USER_C_KEY",
        "TEST_USER_D_KEY",
        "TEST_USER_E_KEY",
        "TEST_USER_F_KEY",
      ]),
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || placeHolderRpcUrl,
      gasPrice: 80000000000,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || placeHolderRpcUrl,
      timeout: 10000000,
      accounts: getAccounts([
        "SAFE_OWNER",
        "TESTNET_PRIVATE_KEY_B",
        "TESTNET_PRIVATE_KEY_C",
        "TESTNET_PRIVATE_KEY_D",
        "TESTNET_PRIVATE_KEY_E",
        "TESTNET_PRIVATE_KEY_F",
      ]),
      // Must have to avoid instead failing as `invalid length for result data` error
      throwOnCallFailures: false, // not sure if this even works
    },
  },
  tenderly: {
    project: `${process.env.TENDERLY_PROJECT_SLUG}`,
    username: `${process.env.TENDERLY_ACCOUNT_ID}`,
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_API_KEY}`,
    customChains: [
      {
        network: "zephyr",
        chainId: 1417429182,
        urls: {
          apiURL: "https://zephyr-blockscout.eu-north-2.gateway.fm/api/",
          browserURL: "https://zephyr-blockscout.eu-north-2.gateway.fm/",
        },
      },
    ],
  },
  sourcify: {
    // If set to "true", will try to verify the contracts after deployment
    enabled: false,
  },
  docgen: {
    pages: "files",
    templates: "docs/docgen-templates",
    outputDir: "docs/contracts",
    exclude: [
      "upgrade-test-mocks/",
      "upgradeMocks/",
      "token/mocks/",
      "utils/",
      "oz-proxies/",
    ],
  },
};

// This will set the default environment variables before running any hardhat scripts
// most of this code relies on. This is needed to ensure that the default environment for tests is set
// up correctly before running any scripts on any machine, including CI, and is not dependent
// on the default environment variables set in the .env file.
// The environment CAN still be overridden by the .env file, but this is the default setup.
// If the current network is hardhat, this will NOT use your local .env file to prevent accidental errors.
const networkArg = process.argv.indexOf("--network");
const isHardhatNetwork = networkArg === -1 || process.argv[networkArg + 1] === "hardhat";

setDefaultEnvironment(!isHardhatNetwork);

export default config;
