// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "../interfaces/AZNSPricing.sol";


contract ZNSFixedPricing is AZNSPricing {

    event PriceChanged(uint256 newPrice);

    uint256 public price;

    constructor(uint256 _price) {
        price = _price;
    }

    // TODO sub: access control
    function setPrice(uint256 _price) external {
        price = _price;

        emit PriceChanged(_price);
    }

    function getPrice(string calldata name) external override view returns (uint256) {
        return price;
    }
}
