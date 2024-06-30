// SPDX-License-Identifier: MIT
/* solhint-disable */
pragma solidity 0.8.3;

import { MeowToken } from "@zero-tech/ztoken/contracts/MeowToken.sol";
import { MeowTokenTest } from "@zero-tech/ztoken/contracts/MeowTokenTest.sol";


contract MeowTokenMock is MeowToken {
    // TODO axe: set everything back when proxies are figured out !!!
    constructor(
        string memory name_,
        string memory symbol_
    ) {
//        __Ownable_init();
//        __ERC20_init(name_, symbol_);
//        __ERC20Snapshot_init();
//        __ERC20Pausable_init();
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}
