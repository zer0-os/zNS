// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

// solhint-disable
import { ZeroToken } from "@zero-tech/ztoken/contracts/ZeroToken.sol";
import { IZeroTokenMock } from "./IZeroTokenMock.sol";

contract ZeroTokenMock is ZeroToken {
    uint256 private _totalSupply = 1000000 * 10 ** 18;

    constructor(address owner) {}
}
