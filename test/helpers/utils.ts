import { ethers, upgrades } from "hardhat";
import { implSlotErc1967 } from "./constants";

export const getProxyImplAddress = async (proxyAddress : string) => {
  let impl;
  try {
    impl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  } catch (e) {
    const padded = await ethers.provider.getStorageAt(proxyAddress, implSlotErc1967);
    impl = ethers.utils.hexStripZeros(padded);
  }

  return impl;
};
