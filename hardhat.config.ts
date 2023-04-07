// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import '@nomicfoundation/hardhat-network-helpers';
import '@nomicfoundation/hardhat-chai-matchers';
import 'solidity-coverage';

const config : HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.18',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: 'typechain',
  },
  mocha: {
    timeout: 40000,
  },
  networks: {
    mainnet: {
      url: 'https://mainnet.infura.io/v3/97e75e0bbc6a4419a5dd7fe4a518b917',
      gasPrice: 80000000000,
    },
    goerli: {
      url: 'https://goerli.infura.io/v3/77c3d733140f4c12a77699e24cb30c27',
      timeout: 10000000,
    },
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_API_KEY}`,
  },
};

export default config;
