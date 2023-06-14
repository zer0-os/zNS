import { BigNumber } from "ethers";
import { PriceParams } from "./types";
import { ethers } from "hardhat";

export const ZNS_DOMAIN_TOKEN_NAME = "ZNS Domain Token";
export const ZNS_DOMAIN_TOKEN_SYMBOL = "ZDT";

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

export const implSlotErc1967 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Contract names
export const accessControllerName = "ZNSAccessController";
export const registryName = "ZNSRegistry";
export const domainTokenName = "ZNSDomainToken";
export const zeroTokenMockName = "ZeroTokenMock";
export const addressResolverName = "ZNSAddressResolver";
export const priceOracleName = "ZNSPriceOracle";
export const treasuryName = "ZNSTreasury";
export const registrarName = "ZNSRegistrar";

