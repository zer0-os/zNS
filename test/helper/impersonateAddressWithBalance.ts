import { ethers } from "ethers";
import * as hre from "hardhat";
import * as helpers from "@nomicfoundation/hardhat-network-helpers"

export const impersonateAddressWithBalance = async (
    address: string,
    balance: string = "0x21E19E0C9BAB2400000"
) => {
    const signer = await hre.ethers.getImpersonatedSigner(address);
    await helpers.setBalance(address, ethers.BigNumber.from(balance));
    return signer;
};