import { ZNSDomainToken__factory, ZNSRootRegistrar__factory, ZNSSubRegistrar__factory } from "../../../typechain";

export const ROOT_COLL_NAME = process.env.MONGO_DB_ROOT_COLL_NAME || "root-domains";
export const SUB_COLL_NAME = process.env.MONGO_DB_SUB_COLL_NAME || "subdomains";

export const ROOT_DOMAIN_BULK_SELECTOR = ZNSRootRegistrar__factory.createInterface().getFunction("registerRootDomainBulk").selector;
export const SUBDOMAIN_BULK_SELECTOR = ZNSSubRegistrar__factory.createInterface().getFunction("registerSubdomainBulk").selector;
export const SAFE_TRANSFER_FROM_SELECTOR = ZNSDomainToken__factory.createInterface().getFunction("safeTransferFrom(address,address,uint256)").selector;

// Safe supported networks, based on the networks we care about specifically
// More can be found here:
// https://docs.safe.global/advanced/smart-account-supported-networks?service=Transaction+Service&service=Safe%7BCore%7D+SDK
export const SAFE_SUPPORTED_NETWORKS = [
  "ethereum",
  "sepolia",
];

export const INVALID_COLL_NAME = process.env.MONGO_DB_INVALID_COLL_NAME || "invalid-domains"; 

export const MEOW_TOKEN_ADDRESS = "0x6ce4a22AA99F9ae41D27E1eC3f40c32b8D0C3113";

export const REGISTER_ROOT_BULK_ABI = { 
  // struct RootDomainRegistrationArgs[]
  components: [
    {
      internalType: "string",
      name: "name",
      type: "string"
    },
    {
      internalType: "address",
      name: "domainAddress",
      type: "address"
    },
    {
      internalType: "address",
      name: "tokenOwner",
      type: "address"
    },
    {
      internalType: "string",
      name: "tokenURI",
      type: "string"
    },
    { // struct DistributionConfig
      components: [
        {
          internalType: "contract IZNSPricer",
          name: "pricerContract",
          type: "address"
        },
        {
          internalType: "enum IDistributionConfig.PaymentType",
          name: "paymentType",
          type: "uint8"
        },
        {
          internalType: "enum IDistributionConfig.AccessType",
          name: "accessType",
          type: "uint8"
        }
      ],
      internalType: "struct IDistributionConfig.DistributionConfig",
      name: "distrConfig",
      type: "tuple"
    },
    { // struct PaymentConfig
      components: [
        {
          internalType: "contract IERC20",
          name: "token",
          type: "address"
        },
        {
          internalType: "address",
          name: "beneficiary",
          type: "address"
        }
      ],
      internalType: "struct PaymentConfig",
      name: "paymentConfig",
      type: "tuple"
    }
  ],
  internalType: "struct IRootRegistrar.RootDomainRegistrationArgs[]",
  name: "args",
  type: "tuple[]"
}


export const REGISTER_SUBS_BULK_ABI = {
  components: [
    {
      internalType: "bytes32",
      name: "parentHash",
      type: "bytes32"
    },
    {
      internalType: "string",
      name: "label",
      type: "string"
    },
    {
      internalType: "address",
      name: "domainAddress",
      type: "address"
    },
    {
      internalType: "address",
      name: "tokenOwner",
      type: "address"
    },
    {
      internalType: "string",
      name: "tokenURI",
      type: "string"
    },
    {
      components: [
        {
          internalType: "contract IZNSPricer",
          name: "pricerContract",
          type: "address"
        },
        {
          internalType: "enum IDistributionConfig.PaymentType",
          name: "paymentType",
          type: "uint8"
        },
        {
          internalType: "enum IDistributionConfig.AccessType",
          name: "accessType",
          type: "uint8"
        },
        {
          internalType: "bytes",
          name: "priceConfig",
          type: "bytes"
        }
      ],
      internalType: "struct IDistributionConfig.DistributionConfig",
      name: "distrConfig",
      type: "tuple"
    },
    {
      components: [
        {
          internalType: "contract IERC20",
          name: "token",
          type: "address"
        },
        {
          internalType: "address",
          name: "beneficiary",
          type: "address"
        }
      ],
      internalType: "struct PaymentConfig",
      name: "paymentConfig",
      type: "tuple"
    }
  ],
  internalType: "struct IZNSSubRegistrar.SubdomainRegisterArgs[]",
  name: "args",
  type: "tuple[]"
}

export const SAFE_TRANSFER_FROM_ABI = [
  {
    internalType: "address",
    name: "from",
    type: "address"
  },
  {
    internalType: "address",
    name: "to",
    type: "address"
  },
  {
    internalType: "uint256",
    name: "tokenId",
    type: "uint256"
  },
];
