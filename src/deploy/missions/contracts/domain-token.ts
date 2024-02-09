import {
  BaseUpgradeMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../constants";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";


export class ZNSDomainTokenDM extends BaseUpgradeMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
DefenderRelayProvider,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.domainToken.contract;
  instanceName = znsNames.domainToken.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const { accessController } = this.campaign;
    const {
      domainToken: {
        name,
        symbol,
        defaultRoyaltyReceiver,
        defaultRoyaltyFraction,
      },
    } = this.config as IZNSCampaignConfig<SignerWithAddress>;

    return [ await accessController.getAddress(), name, symbol, defaultRoyaltyReceiver, defaultRoyaltyFraction ];
  }
}
