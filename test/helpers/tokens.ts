import { Signer } from "ethers";
import { IERC20__factory } from "../../typechain";

export const ETH_MULTIPLIER = BigInt(10) ** BigInt(18);

export const toTokenValue = (
  value : number | string | BigInt,
  decimals : number | string | BigInt = 18
) => BigInt(value.toString()) * BigInt(10) ** (BigInt(decimals.toString()));

export const getTokenContract = (
  address : string,
  signer : Signer
) => {
  const ierc20 = IERC20__factory.connect(address, signer);
  return ierc20.attach(address);
};
