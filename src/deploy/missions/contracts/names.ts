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
    contract: "MeowToken",
    contractMock: "MeowTokenMock",
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
  chainResolver: {
    contract: "ZNSChainResolver",
    instance: "chainResolver",
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
    contractBase: "ZNSRootRegistrarBase",
    contractTrunk: "ZNSRootRegistrarTrunk",
    contractBranch: "ZNSRootRegistrarBranch",
    instance: "rootRegistrar",
  },
  subRegistrar: {
    contractTrunk: "ZNSSubRegistrarTrunk",
    contractBranch: "ZNSSubRegistrarBranch",
    instance: "subRegistrar",
  },
  zPortal: {
    contract: "ZNSZChainPortal",
    instance: "zPortal",
  },
  ethPortal: {
    contract: "ZNSEthereumPortal",
    instance: "ethPortal",
  },
  zkEvmBridge: {
    contract: "PolygonZkEVMBridgeV2",
    contractMock: "PolygonZkEVMBridgeV2Mock",
    instance: "zkEvmBridge",
  },
  erc1967Proxy: {
    contract: erc1967ProxyName,
    instance: "erc1967Proxy",
  },
};
