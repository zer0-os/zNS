import { BaseDeployMission } from "../base-deploy-mission";
import { ProxyKinds, znsNames } from "../../constants";
import { TDeployArgs } from "../types";

class DomainTokenDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.domainToken.contract;
  instanceName = znsNames.domainToken.instance;

  deployArgs () : TDeployArgs {
    const { accessController: { address: acAddress } } = this.campaign;
    const { domainToken: { name, symbol } } = this.config;

    return [ acAddress, name, symbol ];
  }
}

export default DomainTokenDM;
