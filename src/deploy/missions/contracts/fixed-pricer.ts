import { ProxyKinds } from "../../constants";
import {
  BaseUpgradeMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSContracts } from "../../campaign/types";


export class ZNSFixedPricerDM extends BaseUpgradeMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
DefenderRelayProvider,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.fixedPricer.contract;
  instanceName = znsNames.fixedPricer.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
    } = this.campaign;

    return [await accessController.getAddress(), await registry.getAddress()];
  }
}
