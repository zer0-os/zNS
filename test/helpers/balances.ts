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
  balanceBefore : bigint;
  userAddress : string;
  target : bigint;
  shouldDecrease ?: boolean;
}) => {
  const balanceAfter = await token.balanceOf(userAddress);
  const diff = shouldDecrease
    ? balanceBefore - balanceAfter
    : balanceAfter - balanceBefore;

  expect(diff).to.eq(target);
};
