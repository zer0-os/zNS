import { BigNumber } from "ethers";
import { PriceParams } from "./types";
import { ethers } from "hardhat";

export const ZNS_DOMAIN_TOKEN_NAME = "ZNSDomainToken";
export const ZNS_DOMAIN_TOKEN_SYMBOL = "ZDT";

export const registrationFeePercDefault = BigNumber.from("222");
export const decimalsDefault = BigNumber.from(18);
export const precisionDefault = BigNumber.from(2);
export const precisionMultiDefault = BigNumber.from(10).pow(decimalsDefault.sub(precisionDefault));
export const percentageMulti = BigNumber.from(100);

export const priceConfigDefault : PriceParams = {
  maxPrice: ethers.utils.parseEther("1000"),
  minPrice: ethers.utils.parseEther("50"),
  maxLength: BigNumber.from(100),
  baseLength: BigNumber.from(4),
  priceMultiplier: BigNumber.from(5),
  precisionMultiplier: precisionMultiDefault,
};
