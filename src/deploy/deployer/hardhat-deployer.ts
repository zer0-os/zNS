import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TDeployArgs, TProxyKind } from "../missions/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractByName } from "@tenderly/hardhat-tenderly/dist/tenderly/types";

export class HardhatDeployer {
  hre : HardhatRuntimeEnvironment;
  signer : SignerWithAddress;

  constructor (signer : SignerWithAddress) {
    this.hre = hre;
    this.signer = signer;
  }

  async getFactory (contractName : string) {
    return this.hre.ethers.getContractFactory(contractName);
  }

  async getContractObject (contractName : string, address : string) {
    const factory = await this.getFactory(contractName);

    return factory.attach(address);
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
    const contractFactory = await this.hre.ethers.getContractFactory(contractName, this.signer);
    const contract = await this.hre.upgrades.deployProxy(contractFactory, args, {
      kind,
    });

    await contract.deployed();

    return contract;
  }

  async deployContract (contractName : string, args : TDeployArgs) {
    const contractFactory = await this.hre.ethers.getContractFactory(contractName, this.signer);
    const contract = await contractFactory.deploy(...args);

    await contract.deployed();

    return contract;
  }

  getContractArtifact (contractName : string) {
    return this.hre.artifacts.readArtifactSync(contractName);
  }

  async getProxyImplAddress (proxyContract : string) {
    return this.hre.upgrades.erc1967.getImplementationAddress(proxyContract);
  }

  async getBytecodeFromChain (address : string) {
    return this.hre.ethers.provider.getCode(address);
  }

  async tenderlyVerify (contracts : Array<ContractByName>) {
    return this.hre.tenderly.verify(...contracts);
  }

  async etherscanVerify ({
    address,
    ctorArgs,
  } : {
    address : string;
    ctorArgs ?: TDeployArgs;
  }) {
    return this.hre.run("verify:verify", {
      address,
      // this should only be used for non-proxied contracts
      // or proxy impls that have actual constructors
      constructorArguments: ctorArgs,
    });
  }
}
