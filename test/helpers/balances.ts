import { BigNumber } from "ethers";
import { IERC20 } from "../../typechain";
import { expect } from "chai";

export const checkBalance = async ({
  token,
  balanceBefore,
  userAddress,
  target,
  shouldDecrease = true,
} : {
  token : IERC20;
  balanceBefore : BigNumber;
  userAddress : string;
  target : BigNumber;
  shouldDecrease ?: boolean;
}) => {
  const balanceAfter = await token.balanceOf(userAddress);
  const diff = shouldDecrease
    ? balanceBefore.sub(balanceAfter)
    : balanceAfter.sub(balanceBefore);

  expect(diff).to.eq(target);
};
