/* eslint-disable @typescript-eslint/no-empty-function */
import { ethers, upgrades } from "hardhat";
import { implSlotErc1967 } from "./constants";

export const getProxyImplAddress = async (proxyAddress : string) => {
  let impl;
  try {
    impl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  } catch (e) {
    const padded = await ethers.provider.getStorage(proxyAddress, implSlotErc1967);
    impl = ethers.toBeHex(ethers.stripZerosLeft(padded));
  }

  return impl;
};

export const loggerMock = {
  ...console,
  log: () => {},
  info: () => {},
  debug: () => {},
};

export const getRandomString = (length : number) => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    result += alphabet.charAt(randomIndex);
  }

  return result;
};