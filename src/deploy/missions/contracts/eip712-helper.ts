import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export class EIP712HelperDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
DefenderRelayProvider,
IZNSContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = znsNames.eip712Helper.contract;
  instanceName = znsNames.eip712Helper.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      eip712Config : {
        name,
        version,
      },
    } = this.config as IZNSCampaignConfig<SignerWithAddress>;

    return [
      name,
      version,
    ];
  }
}
