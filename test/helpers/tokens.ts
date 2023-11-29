import { ERC20, IERC20__factory } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getTokenContract = (
  address : string,
  signer : SignerWithAddress
) : ERC20 => {
  const ierc20 = IERC20__factory.connect(address, signer);
  return ierc20.attach(address) as ERC20;
};
