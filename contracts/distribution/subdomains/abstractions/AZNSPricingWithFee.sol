// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "./AZNSPricing.sol";


abstract contract AZNSPricingWithFee is AZNSPricing {
    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label
    ) external view virtual returns (uint256 price, uint256 fee);
}
