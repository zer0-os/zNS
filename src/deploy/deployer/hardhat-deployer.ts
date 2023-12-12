import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TDeployArgs, TProxyKind } from "../missions/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractByName } from "@tenderly/hardhat-tenderly/dist/tenderly/types";
import { DefenderHardhatUpgrades, HardhatUpgrades } from "@openzeppelin/hardhat-upgrades";
import { ethers } from "ethers";

import {
  DefenderRelayProvider,
  DefenderRelaySigner
} from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { Defender } from "@openzeppelin/defender-sdk";
import { ContractV6 } from "../campaign/types";
import { Signer } from "ethers";

export class HardhatDeployer {
  hre : HardhatRuntimeEnvironment;
  provider : DefenderRelayProvider;
  signer : SignerWithAddress | DefenderRelaySigner;
  env : string;

  // TODO for test updates, make a mock Defender object to give a client with a signer
  // can be signer from hh
  constructor (
    signer : SignerWithAddress | DefenderRelaySigner,
    provider : DefenderRelayProvider,
    env : string
  ) {
    this.hre = hre;
    this.provider = provider;
    this.signer = signer;
    this.env = env;
  }

  async getFactory (contractName : string, signer ?: SignerWithAddress | DefenderRelaySigner) {
    const attachedSigner = signer ?? this.signer;
    return this.hre.ethers.getContractFactory(contractName, attachedSigner as ethers.Signer);
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
  }) : Promise<ContractV6> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const contractFactory = await this.getFactory(contractName);
    const deployment = await this.hre.upgrades.deployProxy(contractFactory, args, {
      kind,
    });

    const tx = await deployment.deploymentTransaction();
    const waitBlocks = this.env === "dev" ? 0 : 3;
    const receipt = await this.provider.waitForTransaction(tx!.hash, waitBlocks);

    return contractFactory.attach(receipt.contractAddress);
  }

  async deployContract (contractName : string, args : TDeployArgs) : Promise<ContractV6> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const contractFactory = await this.getFactory(contractName);
    const deployment = await contractFactory.deploy(...args);

    const tx = await deployment.deploymentTransaction();
    const waitBlocks = this.env === "dev" ? 0 : 3;
    const receipt = await this.provider.waitForTransaction(tx!.hash, waitBlocks);

    return contractFactory.attach(receipt.contractAddress);
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
