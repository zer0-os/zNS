/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars */

import { mochaGlobalSetup, mochaGlobalTeardown } from "./test/mocha-global";

require("dotenv").config();

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

// This call is needed to initialize Tenderly with Hardhat,
// the automatic verifications, though, don't seem to work,
// needing us to verify explicitly in code, however,
// for Tenderly to work properly with Hardhat this method
// needs to be called. The call below is commented out
// because if we leave it here, solidity-coverage
// does not work properly locally or in CI, so we
// keep it commented out and uncomment when using DevNet
// locally.
// !!! Uncomment this when using Tenderly !!!
tenderly.setup({ automaticVerifications: false });

const config : HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.3",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    overrides: {
      "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol": {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol": {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
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
    // TODO upg: add forking, but make an env var to turn it on/off in the upgrade test
    mainnet: {
      url: `${process.env.MAINNET_RPC_URL}`,
      accounts: [
        // Read only
        `${process.env.TESTNET_PRIVATE_KEY_A}`,
      ],
      gasPrice: 80000000000,
    },
    sepolia: {
      url: `${process.env.SEPOLIA_RPC_URL}`,
      timeout: 10000000,
      // accounts: [ // Comment out for CI, uncomment this when using Sepolia
      //   `${process.env.TESTNET_PRIVATE_KEY_A}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_B}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_C}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_D}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_E}`,
      //   `${process.env.TESTNET_PRIVATE_KEY_F}`,
      // ],
      // // Must have to avoid instead failing as `invalid length for result data` error
      // throwOnCallFailures: false, // not sure if this even works
    },
    devnet: {
      // Add current URL that you spawned if not using automated spawning
      url: `${process.env.DEVNET_RPC_URL}`,
      chainId: 1,
    },
  },
  defender: {
    useDefenderDeploy: false,
    apiKey: `${process.env.DEFENDER_KEY}`,
    apiSecret: `${process.env.DEFENDER_SECRET}`,
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_API_KEY}`,
  },
  sourcify: {
    // If set to "true", will try to verify the contracts after deployment
    enabled: false,
  },
  tenderly: {
    project: `${process.env.TENDERLY_PROJECT_SLUG}`,
    username: `${process.env.TENDERLY_ACCOUNT_ID}`,
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
