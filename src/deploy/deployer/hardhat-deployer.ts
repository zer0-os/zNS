import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ITenderlyContractData, TDeployArgs, TProxyKind } from "../missions/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "ethers";
import axios from "axios";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { ContractV6 } from "../campaign/types";

export class HardhatDeployer {
  hre : HardhatRuntimeEnvironment;
  signer : SignerWithAddress | DefenderRelaySigner;
  env : string;
  provider ?: DefenderRelayProvider;

  constructor (
    signer : SignerWithAddress | DefenderRelaySigner,
    env : string,
    provider ?: DefenderRelayProvider,
  ) {
    this.hre = hre;
    this.signer = signer;
    this.env = env;
    this.provider = provider;
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

    let receipt;
    if (!this.provider) {
      return deployment.waitForDeployment();
    } else {
      const tx = await deployment.deploymentTransaction();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      receipt = await this.provider.waitForTransaction(tx!.hash, 3);

      return contractFactory.attach(receipt.contractAddress);
    }
  }

  async deployContract (contractName : string, args : TDeployArgs) : Promise<ContractV6> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const contractFactory = await this.getFactory(contractName);
    const deployment = await contractFactory.deploy(...args);

    let receipt;
    if (!this.provider) {
      return deployment.waitForDeployment();
    } else {
      const tx = await deployment.deploymentTransaction();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      receipt = await this.provider.waitForTransaction(tx!.hash, 3);

      return contractFactory.attach(receipt.contractAddress);
    }
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

  async tenderlyPush (contracts : Array<ITenderlyContractData>) {
    //     curl -X POST https://api.tenderly.co/api/v1/account/$ACCOUNT_SLUG/project/$PROJECT_SLUG/address \
    //       --header "Content-Type: application/json" \
    //       --header "X-Access-Key: $ACCESS_KEY" \
    //       --data-raw '{
    //          "network_id": "42",
    //          "address": "0x404469525f6Ab4023Ce829D8F627d424D3986675"
    //        }'

    // write axios post based on the comment above
    const inst = axios.create({
      baseURL: "https://api.tenderly.co/",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": process.env.TENDERLY_ACCESS_KEY,
      },
    });

    const { data } = await inst.post(
      `api/v2/accounts/${process.env.TENDERLY_ACCOUNT_ID}/projects/${process.env.TENDERLY_PROJECT_SLUG}/contracts`,
      {
        contracts,
      }
    );

    return data;
    // this below does not push to the project
    // return this.hre.tenderly.verify(...contracts);
  }

  async etherscanVerify ({
    address,
    ctorArgs,
  } : {
    address : string;
    ctorArgs ?: TDeployArgs;
  }) {
    // TODO is there a smart way to check if already verified?
    return this.hre.run("verify:verify", {
      address,
      // this should only be used for non-proxied contracts
      // or proxy impls that have actual constructors
      constructorArguments: ctorArgs,
    });
  }
}
