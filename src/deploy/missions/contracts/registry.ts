import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSContracts } from "../../campaign/types";


export class ZNSRegistryDM extends BaseDeployMission<
DefenderRelayProvider,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.registry.contract;
  instanceName = znsNames.registry.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const { accessController } = this.campaign;
    return [ await accessController.getAddress() ];
  }
}
