import {
  BaseDeployMission,
  IDeployMissionArgs,
  TDeployArgs,
} from "@zero-tech/zdc";
import { znsNames } from "../../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../../../campaign/types";
import { IZTokenConfig } from "../../../types";
import { ZToken__factory } from "../../../../../../typechain";


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

    if (this.config.mockZToken) {
      this.contractName = znsNames.zToken.contractMock;
    } else {
      this.contractName = znsNames.zToken.contract;
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
      // TODO remove!
      // const baseContract = await this.campaign.deployer.getContractObject(
      //   this.contractName,
      //   this.config.stakingTokenAddress as string,
      // );

      await this.saveToDB(baseContract);

      this.campaign.updateStateContract(this.instanceName, this.contractName, baseContract);

      // eslint-disable-next-line max-len
      this.logger.info(`Successfully created ${this.contractName} contract from Mainnet data at ${await baseContract.getAddress()}`);
    } else {
      await super.deploy();
    }
  }

  async deployArgs () : Promise<TDeployArgs> {
    const {
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
  }
}
