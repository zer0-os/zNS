// SPDX-License-Identifier: MIT
/* solhint-disable */
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract ERC20Mock is ERC20 {
    constructor(string memory name_, string memory symbol_)
    ERC20(name_, symbol_) {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
