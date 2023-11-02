/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars */
require("dotenv").config();

import { HardhatUserConfig } from "hardhat/config";
import * as tenderly from "@tenderly/hardhat-tenderly";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";
import "solidity-docgen";
import "hardhat-gas-reporter";

// This call is needed to initialize Tenderly with Hardhat,
// the automatic verifications, though, don't seem to work,
// needing us to verify explicitly in code, however,
// for Tenderly to work properly with Hardhat this method
// needs to be called. The call below is commented out
// because if we leave it here, solidity-coverage
// does not work properly locally or in CI, so we
// keep it commented out and uncomment when using DevNet
// locally.
// !!! Uncomment this when using Tenderly DevNet !!!
// tenderly.setup({ automaticVerifications: false });

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
    mainnet: {
      url: "https://mainnet.infura.io/v3/97e75e0bbc6a4419a5dd7fe4a518b917",
      gasPrice: 80000000000,
    },
    goerli: {
      url: "https://goerli.infura.io/v3/77c3d733140f4c12a77699e24cb30c27",
      timeout: 10000000,
    },
    devnet: {
      // Add current URL that you spawned if not using automated spawning
      url: `${process.env.DEVNET_RPC_URL}`,
      chainId: 1,
    },
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_API_KEY}`,
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
