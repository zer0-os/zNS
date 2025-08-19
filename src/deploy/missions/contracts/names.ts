export const erc1967ProxyName = "ERC1967Proxy";
export const transparentProxyName = "TransparentUpgradeableProxy";

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
    contract: "ZToken",
    contractMock: "ERC20Mock",
    instance: "meowToken",
  },
  addressResolver: {
    contract: "ZNSAddressResolver",
    instance: "addressResolver",
  },
  stringResolver: {
    contract: "ZNSStringResolver",
    instance: "stringResolver",
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
