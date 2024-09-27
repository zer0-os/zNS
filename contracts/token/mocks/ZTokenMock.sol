// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ZToken } from "@zero-tech/z-token/contracts/ZToken.sol";


contract ZTokenMock is ZToken {
    constructor(
        string memory _name,
        string memory _symbol,
        address _defaultAdmin,
        uint48 _initialAdminDelay,
        address _minter,
        address _mintBeneficiary,
        uint256 _initialSupplyBase,
        uint16[] memory _inflationRates,
        uint16 _finalInflationRate
    ) ZToken(
        _name,
        _symbol,
        _defaultAdmin,
        _initialAdminDelay,
        _minter,
        _mintBeneficiary,
        _initialSupplyBase,
        _inflationRates,
        _finalInflationRate
    ) {}

    // for tests, to identify mock contract
    function identifyMock() external pure returns (string memory) {
        return "This is a mock token";
    }
}