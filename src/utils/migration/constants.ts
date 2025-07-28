import { ZNSDomainToken__factory, ZNSRootRegistrar__factory, ZNSSubRegistrar__factory } from "../../../typechain";

export const ROOT_COLL_NAME = process.env.MONGO_DB_ROOT_COLL_NAME || "root-domains";
export const SUB_COLL_NAME = process.env.MONGO_DB_SUB_COLL_NAME || "subdomains";
export const INVALID_COLL_NAME = process.env.MONGO_DB_INVALID_COLL_NAME || "invalid-domains";
export const INVALID_TX_COLL_NAME = process.env.MONGO_DB_INVALID_COLL_NAME || "invalid-transactions";

export const ROOT_DOMAIN_BULK_SELECTOR = ZNSRootRegistrar__factory.createInterface().getFunction(
  "registerRootDomainBulk"
).selector;
export const SUBDOMAIN_BULK_SELECTOR = ZNSSubRegistrar__factory.createInterface().getFunction(
  "registerSubdomainBulk"
).selector;
export const SAFE_TRANSFER_FROM_SELECTOR = ZNSDomainToken__factory.createInterface().getFunction(
  "safeTransferFrom(address,address,uint256)"
).selector;

// Safe supported networks, based on the networks we care about specifically
export const SAFE_SUPPORTED_NETWORKS = [
  "mainnet",
  "sepolia",
];
