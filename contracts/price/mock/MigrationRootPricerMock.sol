// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSPricer } from "../../types/IZNSPricer.sol";


contract MigrationRootPricerMock is IZNSPricer {
    string public constant REVERT_REASON = "Domain registration is disabled because ZNS is migrating to another chain";

    function getPrice(
        bytes32 parentHash,
        string calldata label,
        bool skipValidityCheck
    ) external view returns (uint256) {
        revert(REVERT_REASON);
    }

    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label,
        bool skipValidityCheck
    ) external view returns (uint256 price, uint256 fee) {
        revert(REVERT_REASON);
    }

    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) external view returns (uint256) {
        return 0;
    }
}
