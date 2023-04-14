// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IZeroTokenMock is IERC20 {
  function burn(address account, uint256 amount) external;
}
