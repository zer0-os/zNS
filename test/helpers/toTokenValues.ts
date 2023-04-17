import { BigNumber } from "ethers";

const multiplier = BigNumber.from(10).pow(BigNumber.from(18));

export const toTokenValue = (number: number | string) => {
  return BigNumber.from(number).mul(multiplier);
};
