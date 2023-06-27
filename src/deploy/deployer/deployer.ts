import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TDeployArgs, TProxyKind } from "../missions/types";

export class Deployer {
  hre : HardhatRuntimeEnvironment;

  constructor () {
    this.hre = hre;
  }

  async deployProxy ({
    contractName,
    args,
    kind,
  } : {
    contractName : string;
    args : TDeployArgs;
    kind : TProxyKind;
  }) {
    const contractFactory = await this.hre.ethers.getContractFactory(contractName);
    const contract = await this.hre.upgrades.deployProxy(contractFactory, args, {
      kind,
    });

    await contract.deployed();

    return contract;
  }

  async deployContract (contractName : string, args : TDeployArgs) {
    const contractFactory = await this.hre.ethers.getContractFactory(contractName);
    const contract = await contractFactory.deploy(...args);

    await contract.deployed();

    return contract;
  }

  async getProxyImplAddress (proxyContract : string) {
    return this.hre.upgrades.erc1967.getImplementationAddress(proxyContract);
  }
}

