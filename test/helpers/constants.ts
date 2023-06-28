import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { IPriceParams } from "../../src/deploy/missions/types";

export const ZNS_DOMAIN_TOKEN_NAME = "ZNS Domain Token";
export const ZNS_DOMAIN_TOKEN_SYMBOL = "ZDT";

export const registrationFeePercDefault = BigNumber.from("222");
export const decimalsDefault = BigNumber.from(18);
export const precisionDefault = BigNumber.from(2);
export const precisionMultiDefault = BigNumber.from(10).pow(decimalsDefault.sub(precisionDefault));

export const priceConfigDefault : IPriceParams = {
  maxPrice: ethers.utils.parseEther("1000"),
  minPrice: ethers.utils.parseEther("50"),
  maxLength: BigNumber.from(100),
  baseLength: BigNumber.from(4),
  priceMultiplier: BigNumber.from(5),
  precisionMultiplier: precisionMultiDefault,
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

