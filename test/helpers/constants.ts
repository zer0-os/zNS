import { ethers } from "hardhat";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";
import { IDistributionConfig, IFixedPriceConfig, IFullDistributionConfig, IPaymentConfig } from "./types";
import { encodePriceConfig } from "./pricing";
import { ZeroHash } from "ethers";

export const DEFAULT_RESOLVER_TYPE = "address";
export const ZNS_DOMAIN_TOKEN_NAME = "ZERO ID";
export const ZNS_DOMAIN_TOKEN_SYMBOL = "ZID";

export const DEFAULT_ROYALTY_FRACTION = BigInt("200");
export const DEFAULT_TOKEN_URI = "https://www.zns.domains/7c654a5f";
export const DEFAULT_PROTOCOL_FEE_PERCENT = BigInt("222");
export const DEFAULT_PERCENTAGE_BASIS = BigInt("10000");

export const DEFAULT_DECIMALS = BigInt(18);
export const DEFAULT_PRECISION = BigInt(2);
export const DEFAULT_PRECISION_MULTIPLIER = BigInt(10) ** (DEFAULT_DECIMALS - DEFAULT_PRECISION);

// eslint-disable-next-line no-shadow
export const AccessType  = {
  LOCKED: 0n,
  OPEN: 1n,
  MINTLIST: 2n,
};

// eslint-disable-next-line no-shadow
export const PaymentType = {
  DIRECT: 0n,
  STAKE: 1n,
};

export const DEFAULT_CURVE_PRICE_CONFIG : ICurvePriceConfig = {
  maxPrice: ethers.parseEther("25000"),
  curveMultiplier: BigInt("1000"),
  maxLength: BigInt(50),
  baseLength: BigInt(4),
  precisionMultiplier: DEFAULT_PRECISION_MULTIPLIER,
  feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
};

export const DEFAULT_CURVE_PRICE_CONFIG_BYTES = encodePriceConfig(DEFAULT_CURVE_PRICE_CONFIG);

export const ZERO_VALUE_CURVE_PRICE_CONFIG_BYTES = ZeroHash
  + ZeroHash.slice(2)
  + ZeroHash.slice(2)
  + ZeroHash.slice(2)
  + ZeroHash.slice(2)
  + ZeroHash.slice(2);


export const DEFAULT_FIXED_PRICE_CONFIG : IFixedPriceConfig = {
  price: ethers.parseEther("50"),
  feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
};

export const FULL_DISTR_CONFIG_EMPTY : IFullDistributionConfig = {
  distrConfig: {
    pricerContract: ethers.ZeroAddress,
    paymentType: PaymentType.DIRECT,
    accessType: AccessType.LOCKED,
    priceConfig: ZeroHash,
  },
  paymentConfig: {
    token: ethers.ZeroAddress,
    beneficiary: ethers.ZeroAddress,
  },
}

export const ZERO_VALUE_FIXED_PRICE_CONFIG_BYTES = ZeroHash + ZeroHash.slice(2);

export const DEFAULT_FIXED_PRICER_CONFIG_BYTES = encodePriceConfig(DEFAULT_FIXED_PRICE_CONFIG);

export const curvePriceConfigEmpty : ICurvePriceConfig = {
  maxPrice: BigInt(0),
  curveMultiplier: BigInt(0),
  maxLength: BigInt(0),
  baseLength: BigInt(0),
  precisionMultiplier: BigInt(0),
  feePercentage: BigInt(0),
};

export const paymentConfigEmpty : IPaymentConfig = {
  token: ethers.ZeroAddress,
  beneficiary: ethers.ZeroAddress,
};

export const distrConfigEmpty : IDistributionConfig = {
  pricerContract: ethers.ZeroAddress,
  paymentType: PaymentType.DIRECT,
  accessType: AccessType.LOCKED,
  priceConfig: ZeroHash,
};

export const fullConfigEmpty : IFullDistributionConfig = {
  paymentConfig: paymentConfigEmpty,
  distrConfig: distrConfigEmpty,
};

export const implSlotErc1967 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Contract names
export const accessControllerName = "ZNSAccessController";
export const registryName = "ZNSRegistry";
export const domainTokenName = "ZNSDomainToken";
export const meowTokenMockName = "ERC20Mock";
export const addressResolverName = "ZNSAddressResolver";
export const curvePricerName = "ZNSCurvePricer";
export const fixedPricerName = "ZNSFixedPricer";
export const treasuryName = "ZNSTreasury";
export const registrarName = "ZNSRootRegistrar";
export const erc1967ProxyName = "ERC1967Proxy";
export const subRegistrarName = "ZNSSubRegistrar";
