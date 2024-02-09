import {
  BaseUpgradeMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSContracts } from "../../campaign/types";


export class ZNSTreasuryDM extends BaseUpgradeMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
DefenderRelayProvider,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.treasury.contract;
  instanceName = znsNames.treasury.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      meowToken,
      config: {
        zeroVaultAddress,
      },
    } = this.campaign;

    return [
      await accessController.getAddress(),
      await registry.getAddress(),
      await meowToken.getAddress(),
      zeroVaultAddress,
    ];
  }
}
