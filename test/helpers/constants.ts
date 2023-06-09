import { BigNumber } from "ethers";
import { PriceParams } from "./types";
import { ethers } from "hardhat";

export const ZNS_DOMAIN_TOKEN_NAME = "ZNS Domain Token";
export const ZNS_DOMAIN_TOKEN_SYMBOL = "ZDT";

export const registrationFeePercDefault = BigNumber.from("222");
export const decimalsDefault = BigNumber.from(18);
export const precisionDefault = BigNumber.from(2);
export const precisionMultiDefault = BigNumber.from(10).pow(decimalsDefault.sub(precisionDefault));

export const priceConfigDefault : PriceParams = {
  maxPrice: ethers.utils.parseEther("25000"),
  minPrice: ethers.utils.parseEther("2000"),
  maxLength: BigNumber.from(50),
  baseLength: BigNumber.from(4),
  precisionMultiplier: precisionMultiDefault,
};

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
