import { ERC20Mock, ERC20Mock__factory } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getTokenContract = (
  address : string,
  signer : SignerWithAddress
) : ERC20Mock => {
  const ierc20 = ERC20Mock__factory.connect(address, signer);
  return ierc20.attach(address) as ERC20Mock;
};
