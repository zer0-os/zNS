import { BaseDeployMission, IDeployMissionArgs, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../../campaign/types";
import { ProxyKinds } from "../../../constants";
import { znsNames } from "../names";
import { ethers } from "ethers";


export class PolygonZkEVMBridgeV2DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
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
  SignerWithAddress,
  IZNSCampaignConfig<SignerWithAddress>,
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

      if (!zkEvmBridgeAddress) throw new Error("No existing ZkEvmBridge address has been passed!");

      this.logger.debug(`Writing ${this.contractName} to DB...`);

      const factory = await this.campaign.deployer.getFactory(this.contractName);
      const contract = factory.attach(zkEvmBridgeAddress);

      await this.saveToDB(contract);

      this.campaign.updateStateContract(this.instanceName, this.contractName, contract);

      // eslint-disable-next-line max-len
      this.logger.info(`Successfully created ${this.contractName} contract from chain data at ${await contract.getAddress()}`);
    } else {
      await super.deploy();
    }
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
