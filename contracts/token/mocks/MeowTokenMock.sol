// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import { MeowToken } from "@zero-tech/ztoken/contracts/MeowToken.sol";


contract MeowTokenMock is MeowToken {
    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
