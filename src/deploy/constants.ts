
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
  zeroToken: {
    contract: "ZeroToken",
    instance: "zeroToken",
  },
  addressResolver: {
    contract: "ZNSAddressResolver",
    instance: "addressResolver",
  },
  priceOracle: {
    contract: "ZNSPriceOracle",
    instance: "priceOracle",
  },
  treasury: {
    contract: "ZNSTreasury",
    instance: "treasury",
  },
  registrar: {
    contract: "ZNSRegistrar",
    instance: "registrar",
  },
  erc1967Proxy: {
    contract: erc1967ProxyName,
    instance: "erc1967Proxy",
  },
};
