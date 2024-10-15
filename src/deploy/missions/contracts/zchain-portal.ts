import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";


// TODO multi: figure out how to set EthereumPortal address on this contract after that is deployed !!!
export class ZChainPortalDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.zPortal.contract;
  instanceName = znsNames.zPortal.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      treasury,
      chainResolver,
      rootRegistrar,
      subRegistrar,
      zkEvmBridge,
      config: {
        crosschain: {
          destNetworkId,
          destChainName,
          destChainId,
          srcZkEvmBridge,
        },
      },
    } = this.campaign;

    // TODO multi: figure out proper handling of this for actual contract AND mock !!!
    const bridgeAddress = !srcZkEvmBridge ? await zkEvmBridge.getAddress() : srcZkEvmBridge;

    return [
      destNetworkId,
      destChainName,
      destChainId,
      bridgeAddress,
      {
        accessController: await accessController.getAddress(),
        registry: await registry.getAddress(),
        chainResolver: await chainResolver.getAddress(),
        treasury: await treasury.getAddress(),
        rootRegistrar: await rootRegistrar.getAddress(),
        subRegistrar: await subRegistrar.getAddress(),
      },
    ];
  }
}
