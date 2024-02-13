import {
  BaseDeployMission,
} from "@zero-tech/zdc";
import { znsNames } from "./names";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSContracts } from "../../campaign/types";


export class ZNSAccessControllerDM extends BaseDeployMission<
DefenderRelayProvider,
IZNSContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = znsNames.accessController.contract;
  instanceName = znsNames.accessController.instance;

  async deployArgs () {
    const {
      governorAddresses,
      adminAddresses,
    } = this.config;

    return [ governorAddresses, adminAddresses ];
  }
}
