// SPDX-License-Identifier: MIT
/* solhint-disable */
pragma solidity 0.8.26;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";


contract ZTokenMock is ERC20Upgradeable {
    function initialize(string memory name_, string memory symbol_) external initializer {
        __ERC20_init(name_, symbol_);
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
