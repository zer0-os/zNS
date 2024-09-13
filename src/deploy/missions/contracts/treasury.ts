import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSTreasuryDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
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
      zToken,
      config: {
        zeroVaultAddress,
      },
    } = this.campaign;

    return [
      await accessController.getAddress(),
      await registry.getAddress(),
      await zToken.getAddress(),
      zeroVaultAddress,
    ];
  }
}
