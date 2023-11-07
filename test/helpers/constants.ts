import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";

// TODO: what is our official Domain Token name?
export const DEFAULT_RESOLVER_TYPE = "address";
export const ZNS_DOMAIN_TOKEN_NAME = "ZNS Domain Token";
export const ZNS_DOMAIN_TOKEN_SYMBOL = "ZDT";

export const DEFAULT_ROYALTY_FRACTION = BigNumber.from("200");
export const DEFAULT_TOKEN_URI = "https://www.zns.domains/7c654a5f";
export const DEFAULT_REGISTRATION_FEE_PERCENT = BigNumber.from("222");
export const DEFAULT_PERCENTAGE_BASIS = BigNumber.from("10000");

export const decimalsDefault = BigNumber.from(18);
export const precisionDefault = BigNumber.from(2);
export const precisionMultiDefault = BigNumber.from(10).pow(decimalsDefault.sub(precisionDefault));

// eslint-disable-next-line no-shadow
export enum AccessType {
  LOCKED,
  OPEN,
  MINTLIST,
}

// eslint-disable-next-line no-shadow
export enum OwnerOf {
  NAME,
  TOKEN,
  BOTH,
}

// eslint-disable-next-line no-shadow
export enum PaymentType {
  DIRECT,
  STAKE,
}

export const priceConfigDefault : ICurvePriceConfig = {
  maxPrice: ethers.utils.parseEther("25000"),
  minPrice: ethers.utils.parseEther("2000"),
  maxLength: BigNumber.from(50),
  baseLength: BigNumber.from(4),
  precisionMultiplier: precisionMultiDefault,
  feePercentage: DEFAULT_REGISTRATION_FEE_PERCENT,
  isSet: true,
};

export const curvePriceConfigEmpty : ICurvePriceConfig = {
  maxPrice: ethers.constants.Zero,
  minPrice: ethers.constants.Zero,
  maxLength: BigNumber.from(0),
  baseLength: BigNumber.from(0),
  precisionMultiplier: BigNumber.from(0),
  feePercentage: BigNumber.from(0),
  isSet: true,
};

export const paymentConfigEmpty = {
  token: ethers.constants.AddressZero,
  beneficiary: ethers.constants.AddressZero,
  paymentType: PaymentType.DIRECT,
};

export const distrConfigEmpty = {
  pricerContract: ethers.constants.AddressZero,
  paymentType: 0,
  accessType: 0,
};

export const fullDistrConfigEmpty = {
  distrConfig: distrConfigEmpty,
  priceConfig: undefined,
  paymentConfig: paymentConfigEmpty,
};

export const implSlotErc1967 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Contract names
export const accessControllerName = "ZNSAccessController";
export const registryName = "ZNSRegistry";
export const domainTokenName = "ZNSDomainToken";
export const meowTokenMockName = "MeowTokenMock";
export const addressResolverName = "ZNSAddressResolver";
export const curvePricerName = "ZNSCurvePricer";
export const fixedPricerName = "ZNSFixedPricer";
export const treasuryName = "ZNSTreasury";
export const registrarName = "ZNSRootRegistrar";
export const erc1967ProxyName = "ERC1967Proxy";
export const transparentProxyName = "TransparentUpgradeableProxy";
export const subRegistrarName = "ZNSSubRegistrar";
