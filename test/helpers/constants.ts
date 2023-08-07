import { BigNumber } from "ethers";
import { IASPriceConfig } from "./types";
import { ethers } from "hardhat";

export const ZNS_DOMAIN_TOKEN_NAME = "ZNS Domain Token";
export const ZNS_DOMAIN_TOKEN_SYMBOL = "ZDT";

export const registrationFeePercDefault = BigNumber.from("222");
export const PERCENTAGE_BASIS = BigNumber.from("10000");
export const decimalsDefault = BigNumber.from(18);
export const precisionDefault = BigNumber.from(2);
export const precisionMultiDefault = BigNumber.from(10).pow(decimalsDefault.sub(precisionDefault));

export const priceConfigDefault : IASPriceConfig = {
  maxPrice: ethers.utils.parseEther("25000"),
  minPrice: ethers.utils.parseEther("2000"),
  maxLength: BigNumber.from(50),
  baseLength: BigNumber.from(4),
  precisionMultiplier: precisionMultiDefault,
  feePercentage: registrationFeePercDefault,
};

export const distrConfigEmpty = {
  pricingContract: ethers.constants.AddressZero,
  paymentContract: ethers.constants.AddressZero,
  accessType: 0,
};

export const paymentConfigEmpty = {
  paymentToken: ethers.constants.AddressZero,
  beneficiary: ethers.constants.AddressZero,
};

export const fullDistrConfigEmpty = {
  distrConfig: distrConfigEmpty,
  priceConfig: BigNumber.from(0),
  paymentConfig: paymentConfigEmpty,
};

export enum AccessType {
  LOCKED,
  OPEN,
  WHITELIST,
}

export const implSlotErc1967 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Contract names
export const accessControllerName = "ZNSAccessController";
export const registryName = "ZNSRegistry";
export const domainTokenName = "ZNSDomainToken";
export const zeroTokenMockName = "ZeroToken";
export const addressResolverName = "ZNSAddressResolver";
export const priceOracleName = "ZNSPriceOracle";
export const treasuryName = "ZNSTreasury";
export const registrarName = "ZNSRegistrar";
export const erc1967ProxyName = "ERC1967Proxy";
export const transparentProxyName = "TransparentUpgradeableProxy";
export const fixedPricingName = "ZNSFixedPricing";
export const asymptoticPricingName = "ZNSAsymptoticPricing";
export const directPaymentName = "ZNSDirectPayment";
export const stakePaymentName = "ZNSStakePayment";
export const subdomainRegistrarName = "ZNSSubdomainRegistrar";
