// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

// solhint-disable
import { MeowToken } from "@zero-tech/ztoken/contracts/MeowToken.sol";
// import { IMeowTokenMock } from "./IZeroTokenMock.sol";

contract MeowTokenMock is MeowToken {
    constructor() {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}