import {
  BaseDeployMission,
  IDeployMissionArgs,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../../../constants";
import { ethers } from "ethers";
import { znsNames } from "../../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../../../campaign/types";
import { MeowToken__factory } from "@zero-tech/ztoken/typechain-js";
import meowArtifact from "@zero-tech/ztoken/artifacts/contracts/MeowToken.sol/MeowToken.json";


export const meowTokenName = "MEOW";
export const meowTokenSymbol = "MEOW";


export class MeowTokenDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.transparent,
  };

  contractName = znsNames.meowToken.contract;
  instanceName = znsNames.meowToken.instance;

  constructor (args : IDeployMissionArgs<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZNSCampaignConfig<SignerWithAddress>,
  IZNSContracts
  >) {
    super(args);

    if (this.config.mockMeowToken) {
      this.contractName = znsNames.meowToken.contractMock;
    }
  }

  async deploy () {
    if (!this.config.mockMeowToken) {
      this.logger.info("Using MEOW token from Mainnet");

      // TODO dep: add proper bytecode comparison here and throw if different!
      // const bytecodeFromChain = await this.campaign.deployer.getBytecodeFromChain(this.config.stakingTokenAddress);

      // const {
      //   bytecode,
      // } = this.getArtifact();

      // if (!compareBytecodeStrict(bytecode, bytecodeFromChain)) {
      //   this.logger.error("MEOW token bytecode compiled in this module differs from Mainnet");
      //   throw new Error(
      //     "MEOW token bytecode compiled in this module differs from Mainnet"
      //   );
      // }

      this.logger.debug(`Writing ${this.contractName} to DB...`);

      if (!this.config.stakingTokenAddress)
        throw new Error("Token is set as non-mocked, but no staking token address provided!");

      const factory = new MeowToken__factory(this.config.deployAdmin);
      const baseContract = factory.attach(this.config.stakingTokenAddress);

      await this.saveToDB(baseContract);

      this.campaign.updateStateContract(this.instanceName, this.contractName, baseContract);

      // eslint-disable-next-line max-len
      this.logger.info(`Successfully created ${this.contractName} contract from Mainnet data at ${await baseContract.getAddress()}`);
    } else {
      await super.deploy();
    }
  }

  getArtifact () {
    return meowArtifact;
  }

  async deployArgs () : Promise<TDeployArgs> {
    return [meowTokenName, meowTokenSymbol];
  }

  async needsPostDeploy () {
    const {
      meowToken,
      config: {
        deployAdmin,
        mockMeowToken,
      },
    } = this.campaign;

    const balance = await meowToken.balanceOf(deployAdmin.address);

    const needs = mockMeowToken && balance === 0n;

    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
  }

  async postDeploy () {
    const {
      meowToken,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    // Mint 100,000 MEOW to the deployer
    const tx = await meowToken.connect(deployAdmin).mint(
      await deployAdmin.getAddress(),
      ethers.parseEther("100000"),
    );
    await this.awaitConfirmation(tx);

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
