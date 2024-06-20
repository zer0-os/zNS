// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSPricer } from "../../types/IZNSPricer.sol";


contract MigrationRootPricerMock is IZNSPricer {
    error DomainRegistrationDisabled();

    function getPrice(
        bytes32 parentHash,
        string calldata label,
        bool skipValidityCheck
    ) external view returns (uint256) {
        revert DomainRegistrationDisabled();
    }

    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label,
        bool skipValidityCheck
    ) external view returns (uint256 price, uint256 fee) {
        revert DomainRegistrationDisabled();
    }

    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) external view returns (uint256) {
        return 0;
    }
}
