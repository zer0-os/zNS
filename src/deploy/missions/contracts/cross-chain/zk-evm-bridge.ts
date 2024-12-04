import { BaseDeployMission, IContractArtifact, IDeployMissionArgs, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZNSCampaignConfig, IZNSContracts, IZNSSigner } from "../../../campaign/types";
import { ProxyKinds } from "../../../constants";
import { znsNames } from "../names";
import { ethers, Interface } from "ethers";


export class PolygonZkEVMBridgeV2DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
IZNSSigner,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.transparent,
  };

  contractName = znsNames.zkEvmBridge.contract;
  instanceName = znsNames.zkEvmBridge.instance;

  constructor (args : IDeployMissionArgs<
  HardhatRuntimeEnvironment,
  IZNSSigner,
  IZNSCampaignConfig,
  IZNSContracts
  >) {
    super(args);

    if (this.config.crosschain.mockZkEvmBridge) {
      this.contractName = znsNames.zkEvmBridge.contractMock;
    }
  }

  async deploy () {
    if (!this.config.crosschain.mockZkEvmBridge) {
      const {
        crosschain: {
          zkEvmBridgeAddress,
        },
      } = this.config;

      this.logger.info("Using PolygonZkEvmBridgeV2 deployed on chain");

      if (!zkEvmBridgeAddress)
        throw new Error("No existing ZkEvmBridge address has been passed to the campaign config!");

      this.logger.debug(`Writing ${this.contractName} to DB...`);

      // TODO multi:
      // const factory = await this.campaign.deployer.getFactory(this.contractName);
      // const contract = factory.attach(zkEvmBridgeAddress);
      const contract = this.getContractObject(zkEvmBridgeAddress);

      await this.saveToDB(contract);

      this.campaign.updateStateContract(this.instanceName, this.contractName, contract);

      // eslint-disable-next-line max-len
      this.logger.info(`Successfully created ${this.contractName} contract from chain data at ${await contract.getAddress()}`);
    } else {
      await super.deploy();
    }
  }

  getContractObject (address : string) {
    // TODO multi: make this better when figured out how to compile the Bridge !!!

    const { abi } = this.getArtifact();
    // TODO multi: fix this !
    const contract = new ethers.Contract(address, abi as unknown as Interface, this.campaign.config.deployAdmin);

    return contract;
  }

  // TODO multi: make this better !!! maybe add a new getContractObject() method to BaseDeployMission for this !!!
  async needsDeploy () {
    const dbContract = await this.getFromDB();

    if (!dbContract) {
      this.logger.info(`${this.dbName} not found in DB, proceeding to deploy...`);
    } else {
      this.logger.info(`${this.dbName} found in DB at ${dbContract.address}, no deployment needed.`);

      const contract = this.getContractObject(dbContract.address);

      // eslint-disable-next-line max-len
      this.logger.debug(`Updating ${this.contractName} in state from DB data with address ${await contract.getAddress()}`);

      this.campaign.updateStateContract(this.instanceName, this.contractName, contract);
    }

    return !dbContract;
  }

  async verify () {
    if (!this.config.crosschain.mockZkEvmBridge) {
      this.logger.info("Skipping verification for PolygonZkEvmBridge since it's already verified.");
      return;
    }

    await super.verify();
  }

  // TODO multi: make this better !!!
  getArtifact () : IContractArtifact {
    return require(
      `${process.cwd()}/node_modules/@zero-tech/zkevm-contracts/compiled-contracts/PolygonZkEVMBridgeV2.json`
    );
  }

  async deployArgs () : Promise<TDeployArgs> {
    // this is ONLY for the Mock version of the Bridge !
    const {
      crosschain: {
        curNetworkId,
        bridgeToken,
      },
    } = this.config;

    const tokenAddress = !bridgeToken ? ethers.ZeroAddress : bridgeToken;

    return [
      curNetworkId as bigint,
      tokenAddress,
    ];
  }
}
