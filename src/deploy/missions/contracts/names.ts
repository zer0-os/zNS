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
    // TODO dep: figure out the proper naming between the Mock and the prod token!
    contract: "MeowTokenMock",
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
