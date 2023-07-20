// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


// TODO sub: abstract or interface?
abstract contract AZNSPricing {
    // TODO sub: do we leave only return of the price
    //  or do we leave fee values here as well?
    function getPrice(string calldata name) external virtual view returns (uint256);
}
