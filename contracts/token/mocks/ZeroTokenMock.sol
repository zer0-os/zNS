// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IZeroTokenMock.sol";


contract ZeroTokenMock is ERC20, IZeroTokenMock {

  uint256 _totalSupply = 1000000 * 10**18;

  constructor(address owner) ERC20("Zero Token Mock", "ZTM") {
    _mint(owner, _totalSupply);
  }

  function burn(address account, uint256 amount) external {
    _burn(account, amount);
  }
}
