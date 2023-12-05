import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TDeployArgs, TProxyKind } from "../missions/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractByName } from "@tenderly/hardhat-tenderly/dist/tenderly/types";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { DefenderHardhatUpgrades, HardhatUpgrades } from "@openzeppelin/hardhat-upgrades";


export class HardhatDeployer {
  hre : HardhatRuntimeEnvironment;
  signer : SignerWithAddress | DefenderRelaySigner;
  deployModule : HardhatUpgrades | DefenderHardhatUpgrades;
  env : string;

  constructor (signer : SignerWithAddress | DefenderRelaySigner, env : string) {
    this.hre = hre;
    this.signer = signer;
    this.env = env;
    this.deployModule = env === "dev" ? this.hre.upgrades : this.hre.defender;
  }

  async getFactory (contractName : string, signer ?: SignerWithAddress | DefenderRelaySigner) {
    return this.hre.ethers.getContractFactory(contractName, signer);
  }

  async getContractObject (contractName : string, address : string) {
    const factory = await this.getFactory(contractName, this.signer);

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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const contractFactory = await this.hre.ethers.getContractFactory(contractName, this.signer);
    const contract = await this.deployModule.deployProxy(contractFactory, args, {
      kind,
    });

    await contract.deployed();

    return contract;
  }

  async deployContract (contractName : string, args : TDeployArgs) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const contractFactory = await this.hre.ethers.getContractFactory(contractName, this.signer);

    let contract;
    if (this.env === "dev") {
      contract = await (this.deployModule as DefenderHardhatUpgrades).deployContract(contractFactory, args);
    } else {
      contract = await contractFactory.deploy(...args);
    }

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
    // TODO is there a smart way to check if already verified?
    return this.hre.run("verify", {
      address,
      // this should only be used for non-proxied contracts
      // or proxy impls that have actual constructors
      constructorArguments: ctorArgs,
    });
  }
}
