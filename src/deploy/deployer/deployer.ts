import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployArgs, ProxyKind } from "../missions/types";

export class Deployer {
  hre : HardhatRuntimeEnvironment;

  constructor () {
    this.hre = hre;
  }

  async deployProxy ({
    contractName,
    args,
    kind = "uups",
  } : {
    contractName : string;
    args : DeployArgs;
    kind ?: ProxyKind;
  }) {
    const contractFactory = await this.hre.ethers.getContractFactory(contractName);
    const contract = await this.hre.upgrades.deployProxy(contractFactory, args, {
      kind,
    });

    await contract.deployed();

    return contract;
  }

  async getProxyImplAddress (proxyContract : string) {
    return this.hre.upgrades.erc1967.getImplementationAddress(proxyContract);
  }

  async deployContract (contractName : string, args : DeployArgs) {
    const contractFactory = await this.hre.ethers.getContractFactory(contractName);
    const contract = await contractFactory.deploy(...args);

    await contract.deployed();

    return contract;
  }
}

