// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "../abstractions/AZNSPricing.sol";


contract ZNSFixedPricing is AZNSPricing {

    event PriceChanged(bytes32 indexed parentHash, uint256 newPrice);

    mapping(bytes32 parentHash => uint256 price) internal prices;


    // TODO sub: access control
    function setPrice(bytes32 parentHash, uint256 _price) external {
        prices[parentHash] = _price;

        emit PriceChanged(parentHash, _price);
    }

    function getPrice(bytes32 parentHash, string calldata name) external override view returns (uint256) {
        return prices[parentHash];
    }
}
