import { BigNumber } from "ethers";

const multiplier = BigNumber.from(10).pow(BigNumber.from(18));

export const toTokenValue = (value : number | string) => BigNumber.from(value).mul(multiplier);
