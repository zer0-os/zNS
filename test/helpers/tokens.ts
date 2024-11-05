import { MeowTokenMock, MeowTokenMock__factory } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getTokenContract = (
  address : string,
  signer : SignerWithAddress
) : MeowTokenMock => {
  const ierc20 = MeowTokenMock__factory.connect(address, signer);
  return ierc20.attach(address) as MeowTokenMock;
};
