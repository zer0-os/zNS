// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


// TODO sub: abstract or interface?
abstract contract AZNSPricing {
    event PriceRevoked(bytes32 indexed parentHash);

    function getPrice(
        bytes32 parentHash,
        string calldata label
    ) external virtual view returns (uint256);

    function feeEnforced() external pure virtual returns (bool) {
        return false;
    }

    function revokePrice(bytes32 domainHash) external virtual;
}
