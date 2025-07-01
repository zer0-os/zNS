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

// This will set the default environment variables before running any hardhat scripts
// most of this code relies on. This is needed to ensure that the default environment for tests is set
// up correctly before running any scripts on any machine, including CI, and is not dependent
// on the default environment variables set in the .env file.
// The environment CAN still be overridden by the .env file, but this is the default setup.
setDefaultEnvironment();

subtask(TASK_TEST_RUN_MOCHA_TESTS)
  .setAction(async (args, hre, runSuper) => {
    await mochaGlobalSetup();
    const testFailures = await runSuper(args);
    await mochaGlobalTeardown();

    return testFailures;
  });


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
      url: `${process.env.ZEPHYR_RPC_URL}`,
      chainId: 1417429182,
      // accounts: [
      //   `${process.env.ZNS_DEPLOYER}`,
      //   `${process.env.ZERO_VAULT_KEY}`,
      //   `${process.env.TEST_USER_A_KEY}`,
      //   `${process.env.TEST_USER_B_KEY}`,
      //   `${process.env.TEST_USER_C_KEY}`,
      //   `${process.env.TEST_USER_D_KEY}`,
      //   `${process.env.TEST_USER_E_KEY}`,
      //   `${process.env.TEST_USER_F_KEY}`,
      // ],
      timeout: 10000000,
      loggingEnabled: true,
    },
    // mainnet: {
    //   url: `${process.env.MAINNET_RPC_URL}`,
    //   gasPrice: 80000000000,
    // },
    sepolia: {
      url: `${process.env.SEPOLIA_RPC_URL}`,
      timeout: 10000000,
      accounts: [ // Comment out for CI, uncomment this when using Sepolia
        `${process.env.SAFE_OWNER}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_B}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_C}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_D}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_E}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_F}`,
      ],
      // // Must have to avoid instead failing as `invalid length for result data` error
      // throwOnCallFailures: false, // not sure if this even works
    },
    hardhat: {
      accounts: [
        {
          privateKey: process.env.TESTNET_PRIVATE_KEY!,
          balance: "10000000000000000000000", // 10k ETH
        },
      ],
    },
    zchain: {
      url: process.env.ZCHAIN_RPC_URL,
      accounts: [ // Comment out for CI, uncomment this when using Sepolia
        `${process.env.TESTNET_PRIVATE_KEY}`,
      ],
      chainId: Number(process.env.ZCHAIN_ID!),
    },
    // devnet: {
    //   // Add current URL that you spawned if not using automated spawning
    //   url: `${process.env.DEVNET_RPC_URL}`,
    //   chainId: 1,
    // },
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

export default config;
