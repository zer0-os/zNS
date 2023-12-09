import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TDeployArgs, TProxyKind } from "../missions/types";
import { ContractByName } from "@tenderly/hardhat-tenderly/dist/tenderly/types";
import {
  DefenderRelayProvider,
  DefenderRelaySigner
} from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { Defender } from "@openzeppelin/defender-sdk";
import { Contractv6 } from "../campaign/types";
import { Signer } from "ethers";

export class HardhatDeployer {
  hre : HardhatRuntimeEnvironment;
  signer : DefenderRelaySigner;
  provider : DefenderRelayProvider;
  client : Defender;

  constructor (client : Defender) {
    this.hre = hre;
    this.client = client
    this.provider = client.relaySigner.getProvider();
    this.signer = client.relaySigner.getSigner(this.provider, { speed: "fast" });
  }

  async getFactory (contractName : string) {
    // TODO ethers / typechain issue with typing here, have to cast to unknown as Signer
    return this.hre.ethers.getContractFactory(contractName, this.signer as unknown as Signer);
  }

  // Return type is Promise<ContractFactory<any[], BaseContract>>
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const contractFactory = await this.getFactory(contractName);
    const deployment = await this.hre.upgrades.deployProxy(contractFactory, args, {
      kind,
    });

    const tx = await deployment.deploymentTransaction();
    const receipt = await this.provider.waitForTransaction(tx!.hash, 3);

    return contractFactory.attach(receipt.contractAddress);
  }

  async deployContract (contractName : string, args : TDeployArgs) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const contractFactory = await this.getFactory(contractName);
    const deployment = await contractFactory.deploy(...args);

    const tx = await deployment.deploymentTransaction();
    const receipt = await this.provider.waitForTransaction(tx!.hash, 3);

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
    return this.hre.run("verify", {
      address,
      // this should only be used for non-proxied contracts
      // or proxy impls that have actual constructors
      constructorArguments: ctorArgs,
    });
  }
}
