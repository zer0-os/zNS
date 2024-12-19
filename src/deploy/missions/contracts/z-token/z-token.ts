/* eslint-disable prefer-const */
import {
  BaseDeployMission,
  IDeployMissionArgs,
  TDeployArgs,
} from "@zero-tech/zdc";
<<<<<<<< HEAD:src/deploy/missions/contracts/zns-base/meow-token/meow-token.ts
import { ProxyKinds } from "../../../../constants";
import { ethers } from "ethers";
import { znsNames } from "../../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../../../campaign/types";
import { MeowToken__factory } from "@zero-tech/ztoken/typechain-js";
import meowArtifact from "@zero-tech/ztoken/artifacts/contracts/MeowToken.sol/MeowToken.json";
import { executeWithConfirmation } from "../../../../zns-campaign";
========
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../../campaign/types";
import { IZTokenConfig } from "../../types";
import { ZToken__factory } from "../../../../../typechain";
>>>>>>>> rc/multi-zns-main:src/deploy/missions/contracts/z-token/z-token.ts


export class ZTokenDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = znsNames.zToken.contract;
  instanceName = znsNames.zToken.instance;

  constructor (args : IDeployMissionArgs<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZNSCampaignConfig<SignerWithAddress>,
  IZNSContracts
  >) {
    super(args);

<<<<<<<< HEAD:src/deploy/missions/contracts/zns-base/meow-token/meow-token.ts
    if (this.config.mockMeowToken) {
      this.contractName = znsNames.meowToken.contractMock;
========
    if (this.config.mockZToken) {
      this.contractName = znsNames.zToken.contractMock;
    } else {
      this.contractName = znsNames.zToken.contract;
>>>>>>>> rc/multi-zns-main:src/deploy/missions/contracts/z-token/z-token.ts
    }
  }

  async deploy () {
    if (!this.config.mockZToken) {
      this.logger.info("Using Z token from Mainnet");

      // TODO dep: add proper bytecode comparison here and throw if different!
      // const bytecodeFromChain = await this.campaign.deployer.getBytecodeFromChain(this.config.stakingTokenAddress);

      // const {
      //   bytecode,
      // } = this.getArtifact();

      // if (!compareBytecodeStrict(bytecode, bytecodeFromChain)) {
      //   this.logger.error("Z token bytecode compiled in this module differs from Mainnet");
      //   throw new Error(
      //     "Z token bytecode compiled in this module differs from Mainnet"
      //   );
      // }

      this.logger.debug(`Writing ${this.contractName} to DB...`);

      const factory = new ZToken__factory(this.config.deployAdmin);
      const baseContract = factory.attach(this.config.stakingTokenAddress);

      await this.saveToDB(baseContract);

      this.campaign.updateStateContract(this.instanceName, this.contractName, baseContract);

      // eslint-disable-next-line max-len
      this.logger.info(`Successfully created ${this.contractName} contract from Mainnet data at ${await baseContract.getAddress()}`);
    } else {
      await super.deploy();
    }
  }

  async deployArgs () : Promise<TDeployArgs> {
    let {
      name,
      symbol,
      defaultAdmin,
      initialAdminDelay,
      minter,
      mintBeneficiary,
      initialSupplyBase,
      inflationRates,
      finalInflationRate,
    } = this.config.zTokenConfig as IZTokenConfig;

<<<<<<<< HEAD:src/deploy/missions/contracts/zns-base/meow-token/meow-token.ts
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
    await executeWithConfirmation(
      meowToken.connect(deployAdmin).mint(
        await deployAdmin.getAddress(),
        ethers.parseEther("100000"),
      )
    );

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
========
    return [
      name,
      symbol,
      defaultAdmin,
      initialAdminDelay,
      minter,
      mintBeneficiary,
      initialSupplyBase,
      inflationRates,
      finalInflationRate,
    ];
>>>>>>>> rc/multi-zns-main:src/deploy/missions/contracts/z-token/z-token.ts
  }
}
