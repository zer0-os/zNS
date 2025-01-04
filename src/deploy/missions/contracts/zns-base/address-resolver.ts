import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds, ResolverTypes } from "../../../constants";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZNSCampaignConfig, IZNSContracts } from "../../../campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { executeWithConfirmation } from "../../../zns-campaign";


export class ZNSAddressResolverDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZNSCampaignConfig<SignerWithAddress>,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.addressResolver.contract;
  instanceName = znsNames.addressResolver.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const { accessController, registry } = this.campaign;

    return [await accessController.getAddress(), await registry.getAddress()];
  }

  async needsPostDeploy () {
    const {
      registry,
      addressResolver,
    } = this.campaign;

    const resolverInReg = await registry.getResolverType(
      ResolverTypes.address,
    );

    const needs = resolverInReg !== await addressResolver.getAddress();
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
  }

  async postDeploy () {
    const {
      registry,
      addressResolver,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    // TODO multi: wrap this in a tx runner that will wait for every tx if not on "dev"
    //  amount of confirmations should be a var passed to the config!
    //  do this for all DMs here after the zDC code is changed!
    await executeWithConfirmation(
      registry.connect(deployAdmin).addResolverType(
        ResolverTypes.address,
        await addressResolver.getAddress()
      )
    );

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
