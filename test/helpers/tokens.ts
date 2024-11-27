import { MeowTokenMock, MeowTokenMock__factory } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSSigner } from "../../src/deploy/campaign/types";


export const getTokenContract = (
  address : string,
  signer : IZNSSigner
) : MeowTokenMock => {
  const ierc20 = MeowTokenMock__factory.connect(address, signer);
  return ierc20.attach(address) as MeowTokenMock;
};
