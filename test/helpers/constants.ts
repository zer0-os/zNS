import { BigNumber } from "ethers";
import { PriceParams } from "./types";
import { ethers } from "hardhat";

export const registrationFeePercDefault = BigNumber.from("222");

export const priceConfigDefault : PriceParams = {
  maxRootDomainPrice: ethers.utils.parseEther("1"),
  minRootDomainPrice: ethers.utils.parseEther("0.001"),
  maxSubdomainPrice: ethers.utils.parseEther("0.2"),
  minSubdomainPrice: ethers.utils.parseEther("0.0002"),
  maxRootDomainLength: BigNumber.from(100),
  baseRootDomainLength: BigNumber.from(3),
  maxSubdomainLength: BigNumber.from(100),
  baseSubdomainLength: BigNumber.from(3),
  priceMultiplier: ethers.BigNumber.from("390"),
};
