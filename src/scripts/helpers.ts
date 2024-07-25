import { ZNSAccessController,
  ZNSAccessController__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSCurvePricer,
  ZNSCurvePricer__factory,
  ZNSDomainToken,
  ZNSDomainToken__factory,
  ZNSFixedPricer,
  ZNSFixedPricer__factory,
  ZNSRegistry,
  ZNSRegistry__factory,
  ZNSRootRegistrar,
  ZNSRootRegistrar__factory,
  ZNSSubRegistrar,
  ZNSSubRegistrar__factory,
  ZNSTreasury,
  ZNSTreasury__factory } from "../../typechain";
import {
  REGISTRY_ADDR,
  ROOT_REGISTRAR_ADDR,
  DOMAIN_TOKEN_ADDR,
  ADDRESS_RESOLVER_ADDR,
  SUBREGISTRAR_ADDR,
  TREASURY_ADDR,
  FIXED_PRICER_ADDR,
  ACCESS_CONTROLLER_ADDR,
} from "./constants";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export const getZNS = (signer : SignerWithAddress) => ({
  registry: ZNSRegistry__factory.connect(REGISTRY_ADDR, signer) as unknown as ZNSRegistry,
  rootRegistrar: ZNSRootRegistrar__factory.connect(ROOT_REGISTRAR_ADDR, signer) as unknown as ZNSRootRegistrar,
  domainToken: ZNSDomainToken__factory.connect(DOMAIN_TOKEN_ADDR, signer) as unknown as ZNSDomainToken,
  addressResolver: ZNSAddressResolver__factory.connect(ADDRESS_RESOLVER_ADDR, signer) as unknown as ZNSAddressResolver,
  subRegistrar: ZNSSubRegistrar__factory.connect(SUBREGISTRAR_ADDR, signer) as unknown as ZNSSubRegistrar,
  treasury: ZNSTreasury__factory.connect(TREASURY_ADDR, signer) as unknown as ZNSTreasury,
  fixedPricer: ZNSFixedPricer__factory.connect(FIXED_PRICER_ADDR, signer) as unknown as ZNSFixedPricer,
  curvedPricer: ZNSCurvePricer__factory.connect(FIXED_PRICER_ADDR, signer) as unknown as ZNSCurvePricer,
  /* eslint-disable max-len */
  accessController: ZNSAccessController__factory.connect(ACCESS_CONTROLLER_ADDR, signer) as unknown as ZNSAccessController,
});