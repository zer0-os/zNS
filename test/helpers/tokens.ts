import { BigNumber } from "ethers";
import { IERC20__factory } from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const ETH_MULTIPLIER = BigNumber.from(10).pow(BigNumber.from(18));

export const toTokenValue = (
  value : number | string | BigNumber,
  decimals : number | string | BigNumber = 18
) => BigNumber.from(value)
  .mul(
    BigNumber.from(10)
      .pow(
        BigNumber.from(decimals)
      )
  );

export const getTokenContract = (
  address : string,
  signer : SignerWithAddress
) => {
  const ierc20 = IERC20__factory.connect(address, signer);
  return ierc20.attach(address);
};
