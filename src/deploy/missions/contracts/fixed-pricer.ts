import { ProxyKinds } from "../../constants";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { znsNames } from "./names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../campaign/types";

export class ZNSFixedPricerDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig,
IZNSContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = znsNames.fixedPricer.contract;
  instanceName = znsNames.fixedPricer.instance;
}
