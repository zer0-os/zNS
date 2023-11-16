import { BaseDeployMission } from "../../base-deploy-mission";
import { ProxyKinds } from "../../../constants";
import { IDeployMissionArgs, TDeployArgs } from "../../types";
import { ethers } from "ethers";
import { znsNames } from "../names";


export const meowTokenName = "MEOW";
export const meowTokenSymbol = "MEOW";


export class MeowTokenDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.transparent,
  };

  contractName = znsNames.meowToken.contract;
  instanceName = znsNames.meowToken.instance;

  constructor (args : IDeployMissionArgs) {
    super(args);

    if (this.config.mockMeowToken) {
      this.contractName = znsNames.meowToken.contractMock;
    } else {
      this.contractName = znsNames.meowToken.contract;
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

      const contract = await this.campaign.deployer.getContractObject(
        this.contractName,
        this.config.stakingTokenAddress,
      );

      await this.saveToDB(contract);

      this.campaign.updateStateContract(this.instanceName, this.contractName, contract);

      this.logger.info(`Successfully created ${this.contractName} contract from Mainnet data at ${contract.address}`);
    } else {
      await super.deploy();
    }
  }

  deployArgs () : TDeployArgs {
    return [meowTokenName, meowTokenSymbol];
  }

  async needsPostDeploy () {
    return this.config.mockMeowToken;
  }

  async postDeploy () {
    const {
      meowToken,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    // Mint 100,000 MEOW to the deployer
    await meowToken.connect(deployAdmin).mint(
      deployAdmin.address,
      ethers.utils.parseEther("100000")
    );
  }
}
