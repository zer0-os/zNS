/* eslint-disable max-classes-per-file */
import { ZNSDomainTokenDM, ZNSRegistryDM, ZNSRootRegistrarDM } from "../../../src/deploy/missions/contracts";


export class ZNSRegistryUpgradeMockDM extends ZNSRegistryDM {
  contractName = "ZNSRegistryUpgradeMock"; // point to the mocked modified contract in `upgrade-test-mocks` dir

  get dbName () : string {
    // TODO upg: import actual contract names map from zDC and use it here in all below DMs!
    return "ZNSRegistry";
  }
}

export class ZNSRootRegistrarUpgradeMockDM extends ZNSRootRegistrarDM {
  contractName = "ZNSRootRegistrarUpgradeMock";

  get dbName () : string {
    return "ZNSRootRegistrar";
  }
}

export class ZNSDomainTokenUpgradeMockDM extends ZNSDomainTokenDM {
  contractName = "ZNSDomainTokenUpgradeMock";

  get dbName () : string {
    return "ZNSDomainToken";
  }
}
