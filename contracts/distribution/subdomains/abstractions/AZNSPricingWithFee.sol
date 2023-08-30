// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "./AZNSPricing.sol";


abstract contract AZNSPricingWithFee is AZNSPricing {
    // TODO sub: what is the better way to structure these calls?
    //  what are the best functions here ??
    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label
    ) external view virtual returns (uint256 price, uint256 fee);

    // TODO sub: do we need this method if we merge both Pricing abstracts
    //  into one ??
    function feeEnforced() external pure virtual override returns (bool) {
        return true;
    }

    // TODO sub: do we need this in the abstract ??
    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) external view virtual returns (uint256);
}
