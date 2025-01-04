import { ZTokenMock, ZTokenMock__factory } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getTokenContract = (
  address : string,
  signer : SignerWithAddress
) : ZTokenMock => {
  const ierc20 = ZTokenMock__factory.connect(address, signer);
  return ierc20.attach(address) as ZTokenMock;
};
