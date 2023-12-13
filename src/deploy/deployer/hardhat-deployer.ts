import * as hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ITenderlyContractData, TDeployArgs, TProxyKind } from "../missions/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelaySigner } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { DefenderHardhatUpgrades, HardhatUpgrades } from "@openzeppelin/hardhat-upgrades";
import { ethers } from "ethers";
import axios from "axios";


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
    // is this typecasting a problem at all?
    // TS gets confused on the function typing here
    // if we use the SignerWithAddress | DefenderRelaySigner type
    return this.hre.ethers.getContractFactory(contractName, signer as ethers.Signer);
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

    await contract.waitForDeployment();

    return contract;
  }

  async deployContract (contractName : string, args : TDeployArgs) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const contractFactory = await this.hre.ethers.getContractFactory(contractName, this.signer);

    let contract;
    if (this.env !== "dev") {
      contract = await (this.deployModule as DefenderHardhatUpgrades).deployContract(contractFactory, args);
    } else {
      contract = await contractFactory.deploy(...args);
    }

    await contract.waitForDeployment();

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
      contracts
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
    return this.hre.run("verify", {
      address,
      // this should only be used for non-proxied contracts
      // or proxy impls that have actual constructors
      constructorArguments: ctorArgs,
    });
  }
}
