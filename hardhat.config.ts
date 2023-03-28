require("dotenv").config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    outDir: "typechain"
  },
  mocha: {
    timeout: 40000
  },
  networks: {
    hardhat: {
      accounts: [
        {
          privateKey: `${process.env.TESTNET_PRIVATE_KEY}`,
          balance: "10000000000000000000000"
        }
      ],
      forking: {
        url: "https://goerli.infura.io/v3/77c3d733140f4c12a77699e24cb30c27",
      }
    },
    mainnet: {
      accounts: [`${process.env.MAINNET_PRIVATE_KEY}`],
      url: `https://mainnet.infura.io/v3/97e75e0bbc6a4419a5dd7fe4a518b917`,
      gasPrice: 80000000000,
    },
    goerli: {
      accounts: [`${process.env.TESTNET_PRIVATE_KEY}`],
      url: "https://goerli.infura.io/v3/77c3d733140f4c12a77699e24cb30c27",
      timeout: 10000000
    },
    localhost: {
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      url: "http://127.0.0.1:8545",
      chainId: 1776,
      accounts: {
        mnemonic: "test test test test test test test test test test test test",
      },
    },
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_API_KEY}`,
  },
};

export default config;
