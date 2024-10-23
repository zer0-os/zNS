import { ZNSZChainPortalDM } from "./zchain-portal";
import { ZNSEthereumPortalDM } from "./eth-portal";
import { ISupportedChains, TSupportedChain } from "./types";


export const SupportedChains : ISupportedChains = {
  z: "ZChain",
  eth: "Ethereum",
};


export const getPortalDM = (chainName : TSupportedChain) => {
  switch (chainName) {
  case SupportedChains.eth:
    return ZNSZChainPortalDM;
  case SupportedChains.z:
    return ZNSEthereumPortalDM;
  default:
    throw new Error(`Unknown unsupported chain: ${chainName}!`);
  }
};
