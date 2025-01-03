import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, REGISTRAR_ROLE } from "../../constants";
import { TDeployArgs } from "../types";
import { znsNames } from "./names";


export class ZNSRootRegistrarDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.rootRegistrar.contract;
  instanceName = znsNames.rootRegistrar.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      accessController,
      registry,
      curvePricer,
      treasury,
      domainToken,
    } = this.campaign;

    return [
      await accessController.getAddress(),
      await registry.getAddress(),
      // we use CurvePricer as the IZNSPricer for root domains
      await curvePricer.getAddress(),
      await treasury.getAddress(),
      await domainToken.getAddress(),
    ];
  }

  async needsPostDeploy () {
    const {
      accessController,
      rootRegistrar,
      config: { deployAdmin },
    } = this.campaign;

    const isRegistrar = await accessController
      .connect(deployAdmin)
      .isRegistrar(await rootRegistrar.getAddress());

    const msg = !isRegistrar ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return !isRegistrar;
  }

  async postDeploy () {
    const {
      accessController,
      rootRegistrar,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    const tx = await accessController
      .connect(deployAdmin)
      .grantRole(REGISTRAR_ROLE, await rootRegistrar.getAddress());
    await tx.wait(2);

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
