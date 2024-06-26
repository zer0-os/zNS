import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSCurvePricerDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
DefenderRelayProvider,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.curvePricer.contract;
  instanceName = znsNames.curvePricer.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      config: {
        rootPriceConfig,
      },
    } = this.campaign;

    return [await accessController.getAddress(), await registry.getAddress(), rootPriceConfig];
  }
}
