import {
  BaseDeployMission,
  IDeployMissionArgs,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../../constants";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../../campaign/types";
import { ZToken__factory } from "../../../../../typechain";
import zArtifact from "../../../../../artifacts/@zero-tech/z-token/contracts/ZToken.sol/ZToken.json";
import { IZTokenConfig } from "../../types";


export const zTokenName = "Z-Token";
export const zTokenSymbol = "Z";


export class ZTokenDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: false,
    kind: ProxyKinds.transparent,
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

  getArtifact () {
    return zArtifact;
  }

  // it will choose the governon as `admin` argument
  // and deployAdmin as `minter` and first passed admin as `mintBeneficiary`.
  async deployArgs () : Promise<TDeployArgs> {
    const {
      initialAdminDelay,
      initialSupplyBase,
      inflationRates,
      finalInflationRate,
    } = this.config.zTokenConfig as IZTokenConfig;
    return [
      zTokenName,
      zTokenSymbol,
      this.config.governorAddresses[0],
      initialAdminDelay,
      this.config.deployAdmin.address,
      this.config.adminAddresses[0],
      initialSupplyBase,
      inflationRates,
      finalInflationRate,
    ];
  }

  async needsPostDeploy () {
    const msg = this.config.ZToken ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return this.config.mockZToken;
  }
}
