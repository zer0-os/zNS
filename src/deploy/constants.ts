import { ethers } from "ethers";

export const ProxyKinds = {
  uups: "uups",
  transparent: "transparent",
  beacon: "beacon",
};

export const erc1967ProxyName = "ERC1967Proxy";

export const znsNames = {
  accessController: {
    contract: "ZNSAccessController",
    instance: "accessController",
  },
  registry: {
    contract: "ZNSRegistry",
    instance: "registry",
  },
  domainToken: {
    contract: "ZNSDomainToken",
    instance: "domainToken",
  },
  meowToken: {
    // TODO dep: change the naming everywhere needed when the new version of zToken is added!
    contract: "ZeroToken",
    instance: "meowToken",
  },
  addressResolver: {
    contract: "ZNSAddressResolver",
    instance: "addressResolver",
  },
  curvePricer: {
    contract: "ZNSCurvePricer",
    instance: "curvePricer",
  },
  fixedPricer: {
    contract: "ZNSFixedPricer",
    instance: "fixedPricer",
  },
  treasury: {
    contract: "ZNSTreasury",
    instance: "treasury",
  },
  rootRegistrar: {
    contract: "ZNSRootRegistrar",
    instance: "rootRegistrar",
  },
  subRegistrar: {
    contract: "ZNSSubRegistrar",
    instance: "subRegistrar",
  },
  erc1967Proxy: {
    contract: erc1967ProxyName,
    instance: "erc1967Proxy",
  },
};
// role names
export const GOVERNOR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["GOVERNOR_ROLE"],
);
export const ADMIN_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["ADMIN_ROLE"],
);
export const REGISTRAR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["REGISTRAR_ROLE"],
);
export const EXECUTOR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["EXECUTOR_ROLE"],
);