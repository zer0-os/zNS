import { BaseDeployMission } from "../../base-deploy-mission";
import { ProxyKinds } from "../../../constants";
import { IDeployMissionArgs, TDeployArgs } from "../../types";
import { ethers } from "ethers";
import { znsNames } from "../names";
import { MeowMainnet } from "../meow-token/mainnet-data";
import assert from "assert";


export const meowTokenName = "MEOW";
export const meowTokenSymbol = "MEOW";


// TODO dep !IMPORTANT!: refine this to create an object if using
//  the actual deployed MEOW, so that we have it's full object present
//  here for easy access and to make sure we get it's ABI and bytecode for the DB
export class MeowTokenMockDM extends BaseDeployMission {
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

      const bytecodeFromChain = await this.campaign.deployer.getBytecodeFromChain(MeowMainnet.proxy);

      const {
        bytecode,
      } = this.getArtifact();

      assert.deepStrictEqual(
        bytecode,
        bytecodeFromChain,
        "MEOW token bytecode compiled in this module differs from Mainnet"
      );

      this.logger.debug(`Writing ${this.contractName} to DB...`);

      const factory = await this.campaign.deployer.getFactory(this.contractName);
      const contract = factory.attach(MeowMainnet.proxy);

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

  // TODO dep: add a needsPostDeploy() hook !!

  async postDeploy () {
    const {
      meowToken,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    // Mint 10,000 ZERO to the deployer
    await meowToken.connect(deployAdmin).mint(
      deployAdmin.address,
      ethers.utils.parseEther("100000")
    );
  }
}
