// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSPricer } from "../types/IZNSPricer.sol";


interface IZNSFixedPricer is IZNSPricer {
    event PriceSet(bytes32 indexed parentHash, uint256 indexed newPrice);
    event FeePercentageSet(bytes32 indexed parentHash, uint256 indexed feePercentage);

    struct PriceConfig {
        uint256 price;
        uint256 feePercentage;
    }

    function priceConfigs(bytes32 domainHash) external view returns (uint256 price, uint256 feePercentage);

    function initialize(address _accessController, address _registry) external;

    function setPrice(bytes32 domainHash, uint256 _price) external;

    function getPrice(bytes32 parentHash, string calldata label) external view returns (uint256);

    function setFeePercentage(
        bytes32 domainHash,
        uint256 feePercentage
    ) external;

    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) external view returns (uint256);

    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label
    ) external view returns (uint256 price, uint256 fee);

    function setPriceConfig(
        bytes32 domainHash,
        PriceConfig calldata priceConfig
    ) external;

    function setRegistry(address registry_) external;
}
