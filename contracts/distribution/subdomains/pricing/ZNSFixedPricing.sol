// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSRegistry } from "../../../registry/IZNSRegistry.sol";
import { AAccessControlled } from "../../../access/AAccessControlled.sol";
import { ARegistryWired } from "../../../abstractions/ARegistryWired.sol";
import { AZNSPricingWithFee } from "../abstractions/AZNSPricingWithFee.sol";


contract ZNSFixedPricing is AAccessControlled, ARegistryWired, AZNSPricingWithFee {

    event PriceSet(bytes32 indexed parentHash, uint256 indexed newPrice);
    event FeePercentageSet(bytes32 indexed parentHash, uint256 indexed feePercentage);

    struct PriceConfig {
        uint256 price;
        uint256 feePercentage;
    }

    uint256 public constant PERCENTAGE_BASIS = 10000;


    mapping(bytes32 domainHash => PriceConfig config) internal priceConfigs;

    constructor(address _accessController, address _registry) {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    function setPrice(bytes32 domainHash, uint256 _price) public onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].price = _price;

        emit PriceSet(domainHash, _price);
    }

    function getPrice(bytes32 parentHash, string calldata label) public override view returns (uint256) {
        return priceConfigs[parentHash].price;
    }

    // TODO sub: is this a viable solution to not pay for subdomains
    //  of a revoked parent ?? this lets us wipe the price at any time for the parent
    // TODO sub: do we need this now since we're not wiping the price ??!!
    function revokePrice(bytes32 domainHash) external override onlyRegistrar {
        priceConfigs[domainHash].price = 0;
        priceConfigs[domainHash].feePercentage = 0;
        emit PriceRevoked(domainHash);
    }

    function setFeePercentage(
        bytes32 domainHash,
        uint256 feePercentage
    ) public onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].feePercentage = feePercentage;
        emit FeePercentageSet(domainHash, feePercentage);
    }

    // TODO sub: do we need both of these functions ??
    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) public view override returns (uint256) {
        return (price * priceConfigs[parentHash].feePercentage) / PERCENTAGE_BASIS;
    }

    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label
    ) external view override returns (uint256 price, uint256 fee) {
        price = getPrice(parentHash, label);
        fee = getFeeForPrice(parentHash, price);
        return (price, fee);
    }

    function setPriceConfig(
        bytes32 domainHash,
        PriceConfig calldata priceConfig
    ) external {
        setPrice(domainHash, priceConfig.price);
        setFeePercentage(domainHash, priceConfig.feePercentage);
    }

    function setRegistry(address registry_) public override onlyAdmin {
        _setRegistry(registry_);
    }

    function setAccessController(address accessController_)
    external
    override
    onlyAdmin {
        _setAccessController(accessController_);
    }

    function getAccessController() external view override returns (address) {
        return address(accessController);
    }
}
