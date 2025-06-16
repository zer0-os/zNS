/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars */
import "./init-env";
import { mochaGlobalSetup, mochaGlobalTeardown } from "./test/mocha-global";


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
          // Only use this when running coverage
          // TODO multi: figure out if this is worth using for actual deploys to networks and tests
          viaIR: process.argv.includes("coverage"),
        },
      },
      {
        version: "0.8.3",
        settings: {
          optimizer: {
            enabled: true,
            runs: 20000,
          },
        },
      },
    ],
    overrides: {
      "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol": {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 20000,
          },
        },
      },
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol": {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 20000,
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
    mainnet: {
      url: `${process.env.MAINNET_RPC_URL}`,
      gasPrice: 80000000000,
    },
    sepolia: {
      url: `${process.env.SEPOLIA_RPC_URL}`,
      timeout: 10000000,
      accounts: [ // Comment out for CI, uncomment this when using Sepolia
        // `${process.env.TESTNET_PRIVATE_KEY_A}`,
        // `${process.env.TESTNET_PRIVATE_KEY_B}`,
        // `${process.env.TESTNET_PRIVATE_KEY_C}`,
        // `${process.env.TESTNET_PRIVATE_KEY_D}`,
        // `${process.env.TESTNET_PRIVATE_KEY_E}`,
        // `${process.env.TESTNET_PRIVATE_KEY_F}`,
      ],
      // // Must have to avoid instead failing as `invalid length for result data` error
      // throwOnCallFailures: false, // not sure if this even works
    },
    devnet: {
      // Add current URL that you spawned if not using automated spawning
      url: `${process.env.DEVNET_RPC_URL}`,
      chainId: 1,
    },
    zephyr: {
      url: `${process.env.ZCHAIN_TEST_RPC_URL}`,
      chainId: 1417429182,
      accounts: [
        `${process.env.TESTNET_PRIVATE_KEY_A}`,
        // `${process.env.TESTNET_PRIVATE_KEY_B}`,
        // `${process.env.TESTNET_PRIVATE_KEY_C}`,
      ],
    },
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
