// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricingWithFee } from "../abstractions/AZNSPricingWithFee.sol";
import { StringUtils } from "../../../utils/StringUtils.sol";
import { IZNSRegistry } from "../../../registry/IZNSRegistry.sol";
// TODO sub: possibly remove if moved to an interface
import { IDomainPriceConfig } from "../../../abstractions/IDomainPriceConfig.sol";
// TODO sub: do we need this ??
import { AAccessControlled } from "../../../access/AAccessControlled.sol";


// TODO sub: figure out how to interface here with the abstract and PriceConfig struct !!
contract ZNSAsymptoticPricing is AAccessControlled, AZNSPricingWithFee, IDomainPriceConfig {
    using StringUtils for string;

    // TODO sub: possibly move to an interface
    event MaxPriceSet(bytes32 indexed domainHash, uint256 price);
    event MinPriceSet(bytes32 indexed domainHash, uint256 price);
    event BaseLengthSet(bytes32 indexed domainHash, uint256 length);
    event MaxLengthSet(bytes32 indexed domainHash, uint256 length);
    event PrecisionMultiplierSet(bytes32 indexed domainHash, uint256 precision);
    event FeePercentageSet(bytes32 indexed domainHash, uint256 feePercentage);
    event PriceConfigSet(
        bytes32 indexed domainHash,
        uint256 maxPrice,
        uint256 minPrice,
        uint256 maxLength,
        uint256 baseLength,
        uint256 precisionMultiplier,
        uint256 feePercentage
    );
    event RegistrySet(address registry);

    IZNSRegistry public registry;

    uint256 public constant PERCENTAGE_BASIS = 10000;

    mapping(bytes32 => DomainPriceConfig) public priceConfigs;

    modifier onlyOwnerOrOperator(bytes32 domainHash) {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSAsymptoticPricing: Not authorized"
        );
        _;
    }

    constructor(address _accessController, address _registry) {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    function getPrice(
        bytes32 parentHash,
        string calldata label
    ) public view override returns (uint256) {
        uint256 length = label.strlen();
        // No pricing is set for 0 length domains
        if (length == 0) return 0;

        return _getPrice(parentHash, label.strlen());
    }

    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label
    ) external view override returns (uint256 price, uint256 fee) {
        price = getPrice(parentHash, label);
        fee = getFeeForPrice(parentHash, price);
        return (price, fee);
    }

    // TODO sub: is this function needed ??
    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) public view override returns (uint256) {
        return price * priceConfigs[parentHash].feePercentage / PERCENTAGE_BASIS;
    }

    // TODO sub: add AC !!!
    function setPriceConfig(
        bytes32 domainHash,
        DomainPriceConfig calldata priceConfig
    // TODO sub: do we need a modifier here since it checks in the function inside ??
    ) external onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].baseLength = priceConfig.baseLength;
        priceConfigs[domainHash].maxPrice = priceConfig.maxPrice;
        priceConfigs[domainHash].minPrice = priceConfig.minPrice;
        priceConfigs[domainHash].maxLength = priceConfig.maxLength;
        priceConfigs[domainHash].feePercentage = priceConfig.feePercentage;
        setPrecisionMultiplier(domainHash, priceConfig.precisionMultiplier);

        _validateConfig(domainHash);

        emit PriceConfigSet(
            domainHash,
            priceConfig.maxPrice,
            priceConfig.minPrice,
            priceConfig.maxLength,
            priceConfig.baseLength,
            priceConfig.precisionMultiplier,
            priceConfig.feePercentage
        );
    }

    function setMaxPrice(
        bytes32 domainHash,
        uint256 maxPrice
    ) external onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].maxPrice = maxPrice;

        if (maxPrice != 0) _validateConfig(domainHash);

        emit MaxPriceSet(domainHash, maxPrice);
    }

    function setMinPrice(
        bytes32 domainHash,
        uint256 minPrice
    ) external onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].minPrice = minPrice;

        _validateConfig(domainHash);

        emit MinPriceSet(domainHash, minPrice);
    }

    function setBaseLength(
        bytes32 domainHash,
        uint256 length
    ) external onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].baseLength = length;

        _validateConfig(domainHash);

        emit BaseLengthSet(domainHash, length);
    }

    function setMaxLength(
        bytes32 domainHash,
        uint256 length
    ) external onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].maxLength = length;

        if (length != 0) _validateConfig(domainHash);

        emit MaxLengthSet(domainHash, length);
    }

    function setPrecisionMultiplier(
        bytes32 domainHash,
        uint256 multiplier
    ) public onlyOwnerOrOperator(domainHash) {
        require(multiplier != 0, "ZNSAsymptoticPricing: precisionMultiplier cannot be 0");
        require(multiplier <= 10**18, "ZNSAsymptoticPricing: precisionMultiplier cannot be greater than 10^18");
        priceConfigs[domainHash].precisionMultiplier = multiplier;

        emit PrecisionMultiplierSet(domainHash, multiplier);
    }

    function setFeePercentage(
        bytes32 domainHash,
        uint256 feePercentage
    ) external onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].feePercentage = feePercentage;
        emit FeePercentageSet(domainHash, feePercentage);
    }

    function setRegistry(address registry_) public onlyAdmin {
        require(registry_ != address(0), "ZNSAsymptoticPricing: _registry can not be 0x0 address");
        registry = IZNSRegistry(registry_);

        emit RegistrySet(registry_);
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

    function _getPrice(
        bytes32 parentHash,
        uint256 labelLength
    ) internal view returns (uint256) {
        DomainPriceConfig memory config = priceConfigs[parentHash];

        // Setting baseLength to 0 indicates to the system that we are
        // currently in a special phase where we define an exact price for all domains
        // e.g. promotions or sales
        if (config.baseLength == 0) return config.maxPrice;
        if (labelLength <= config.baseLength) return config.maxPrice;
        if (labelLength > config.maxLength) return config.minPrice;

        return
            (config.baseLength * config.maxPrice / labelLength)
            / config.precisionMultiplier * config.precisionMultiplier;
    }

    /**
     * @notice Internal function called every time we set props of `priceConfigs[domainHash]`
     * to make sure that values being set can not disrupt the price curve or zero out prices
     * for domains. If this validation fails, function will revert.
     * @dev We are checking here for possible price spike at `maxLength`
     * which can occur if some of the config values are not properly chosen and set.
     */
    function _validateConfig(bytes32 domainHash) internal view {
        uint256 prevToMinPrice = _getPrice(domainHash, priceConfigs[domainHash].maxLength - 1);
        require(
            priceConfigs[domainHash].minPrice < prevToMinPrice,
            "ZNSAsymptoticPricing: incorrect value set causes the price spike at maxLength."
        );
    }
}
