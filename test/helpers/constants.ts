import { BigNumber } from "ethers";
import { PriceParams } from "./types";
import { ethers } from "hardhat";

export const ZNS_DOMAIN_TOKEN_NAME = "ZNSDomainToken";
export const ZNS_DOMAIN_TOKEN_SYMBOL = "ZDT";

export const registrationFeePercDefault = BigNumber.from("222");
export const decimalsDefault = BigNumber.from(10).pow(BigNumber.from(18));
export const precisionDefault = BigNumber.from(10).pow(BigNumber.from(2));
export const precisionMultiDefault = decimalsDefault.sub(precisionDefault);

export const priceConfigDefault : PriceParams = {
  maxPrice: ethers.utils.parseEther("1"),
  minPrice: ethers.utils.parseEther("0.001"),
  maxLength: BigNumber.from(100),
  baseLength: BigNumber.from(3),
  priceMultiplier: ethers.BigNumber.from("390"),
  precisionMultiplier: precisionMultiDefault,
};
