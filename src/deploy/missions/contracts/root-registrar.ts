import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, REGISTRAR_ROLE } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";
import { Signer } from "ethers";


export class ZNSRootRegistrarDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.rootRegistrar.contract;
  instanceName = znsNames.rootRegistrar.instance;

  deployArgs () : TDeployArgs {
    const accessControllerAddress = this.campaign.state.contracts.accessController.target.toString();
    const registryAddress = this.campaign.state.contracts.registry.target.toString();
    const curvePricerAddress = this.campaign.state.contracts.curvePricer.target.toString();
    const treasuryAddress = this.campaign.state.contracts.treasury.target.toString();
    const domainTokenAddress = this.campaign.state.contracts.domainToken.target.toString();

    return [
      accessControllerAddress,
      registryAddress,
      // we use CurvePricer as the IZNSPricer for root domains
      curvePricerAddress,
      treasuryAddress,
      domainTokenAddress,
    ];
  }

  async needsPostDeploy () {
    // TODO destructuring here will fail like it fails in other places, switch to get target like above in deployargs
    const {
      config: { deployAdmin },
    } = this.campaign;

    const accessController = this.campaign.state.contracts.accessController;
    const rootRegistrarAddress = this.campaign.state.contracts.rootRegistrar.target.toString();

    const isRegistrar = await accessController
      .connect(deployAdmin as unknown as Signer) // TODO might be a big problem, other way to use DefenderRelaySigner => Signer?
      .isRegistrar(rootRegistrarAddress);

    return !isRegistrar;
  }

  async postDeploy () {
    const {
      config: {
        deployAdmin,
      },
    } = this.campaign;

    const accessController = this.campaign.state.contracts.accessController;
    const rootRegistrarAddress = this.campaign.state.contracts.rootRegistrar.target.toString();

    await accessController
      .connect(deployAdmin as unknown as Signer)
      .grantRole(REGISTRAR_ROLE, rootRegistrarAddress);
  }
}
