// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IZeroTokenMock } from "./IZeroTokenMock.sol";

contract ZeroTokenMock is ERC20, IZeroTokenMock {
    uint256 private _totalSupply = 1000000 * 10 ** 18;

    constructor(address owner) ERC20("Zero Token Mock", "ZTM") {
        _mint(owner, _totalSupply);
    }

    function balanceOf(
        address user
    ) public view override(ERC20, IERC20) returns (uint) {
        return super.balanceOf(user);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
