// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSCurvePricer } from "./IZNSCurvePricer.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";


/**
 * @title Implementation of the Curve Pricing, module that calculates the price of a domain
 * based on its length and the rules set by Zero ADMIN.
 */
contract ZNSCurvePricer is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSCurvePricer {
    using StringUtils for string;

    /**
     * @notice Value used as a basis for percentage calculations,
     * since Solidity does not support fractions.
     */
    uint256 public constant PERCENTAGE_BASIS = 10000;

    mapping(bytes32 domainHash => DomainPriceConfig config) public priceConfigs;

    /**
     * @notice Proxy initializer to set the initial state of the contract after deployment.
     * Only ADMIN can call this function.
     * @dev > Note the for DomainPriceConfig we set each value individually and calling
     * 2 important functions that validate all of the config's values against the formula:
     * - `setPrecisionMultiplier()` to validate precision multiplier
     * - `_validateConfig()` to validate the whole config in order to avoid price spikes
     * @param accessController_ the address of the ZNSAccessController contract.
     * @param zeroPriceConfig_ a number of variables that participate in the price calculation for Zero.
     */
    function initialize(
        address accessController_,
        address registry_,
        DomainPriceConfig calldata zeroPriceConfig_
    ) external override initializer {
        _setAccessController(accessController_);
        _setRegistry(registry_);

        setPriceConfig(0x0, zeroPriceConfig_);
    }

    /**
     * @notice Get the price of a given domain name
     * @param label The name of the domain to check
     */
    function getPrice(
        bytes32 parentHash,
        string calldata label
    ) public view override returns (uint256) {
        uint256 length = label.strlen();
        // No pricing is set for 0 length domains
        if (length == 0) return 0;

        return _getPrice(parentHash, length);
    }

    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) public view override returns (uint256) {
        return (price * priceConfigs[parentHash].feePercentage) / PERCENTAGE_BASIS;
    }

    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label
    ) external view override returns (uint256 price, uint256 stakeFee) {
        price = getPrice(parentHash, label);
        stakeFee = getFeeForPrice(parentHash, price);
        return (price, stakeFee);
    }

    /**
     * @notice Setter for `priceConfigs[domainHash]`. Only ADMIN can call this function.
     * @dev Validates the value of the `precisionMultiplier` and the whole config in order to avoid price spikes,
     * fires `PriceConfigSet` event.
     * Only ADMIN can call this function.
     * @param priceConfig The new price config to set
     */
    function setPriceConfig(
        bytes32 domainHash,
        DomainPriceConfig calldata priceConfig
    ) public override {
        setPrecisionMultiplier(domainHash, priceConfig.precisionMultiplier);
        priceConfigs[domainHash].baseLength = priceConfig.baseLength;
        priceConfigs[domainHash].maxPrice = priceConfig.maxPrice;
        priceConfigs[domainHash].minPrice = priceConfig.minPrice;
        priceConfigs[domainHash].maxLength = priceConfig.maxLength;
        priceConfigs[domainHash].feePercentage = priceConfig.feePercentage;

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

    /**
     * @notice Sets the max price for domains. Validates the config with the new price.
     * Fires `MaxPriceSet` event.
     * Only ADMIN can call this function.
     * > `maxPrice` can be set to 0 along with `baseLength` or `minPrice` to make all domains free!
     * @param maxPrice The maximum price to set in $ZERO
     */
    function setMaxPrice(
        bytes32 domainHash,
        uint256 maxPrice
    ) external override onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].maxPrice = maxPrice;

        if (maxPrice != 0) _validateConfig(domainHash);

        emit MaxPriceSet(domainHash, maxPrice);
    }

    /**
     * @notice Sets the minimum price for domains. Validates the config with the new price.
     * Fires `MinPriceSet` event.
     * Only ADMIN can call this function.
     * @param minPrice The minimum price to set in $ZERO
     */
    function setMinPrice(
        bytes32 domainHash,
        uint256 minPrice
    ) external override onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].minPrice = minPrice;

        _validateConfig(domainHash);

        emit MinPriceSet(domainHash, minPrice);
    }

    /**
     * @notice Set the value of the domain name length boundary where the `maxPrice` applies
     * e.g. A value of '5' means all domains <= 5 in length cost the `maxPrice` price
     * Validates the config with the new length. Fires `BaseLengthSet` event.
     * Only ADMIN can call this function.
     * > `baseLength` can be set to 0 to make all domains cost `maxPrice`!
     * > This indicates to the system that we are
     * > currently in a special phase where we define an exact price for all domains
     * > e.g. promotions or sales
     * @param length Boundary to set
     */
    function setBaseLength(
        bytes32 domainHash,
        uint256 length
    ) external override onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].baseLength = length;

        _validateConfig(domainHash);

        emit BaseLengthSet(domainHash, length);
    }

    /**
     * @notice Set the maximum length of a domain name to which price formula applies.
     * All domain names (labels) that are longer than this value will cost the fixed price of `minPrice`,
     * and the pricing formula will not apply to them.
     * Validates the config with the new length.
     * Fires `MaxLengthSet` event.
     * Only ADMIN can call this function.
     * > `maxLength` can be set to 0 to make all domains cost `minPrice`!
     * @param length The maximum length to set
     */
    function setMaxLength(
        bytes32 domainHash,
        uint256 length
    ) external override onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].maxLength = length;

        if (length != 0) _validateConfig(domainHash);

        emit MaxLengthSet(domainHash, length);
    }

    /**
     * @notice Sets the precision multiplier for the price calculation.
     * Multiplier This should be picked based on the number of token decimals
     * to calculate properly.
     * e.g. if we use a token with 18 decimals, and want precision of 2,
     * our precision multiplier will be equal to `10^(18 - 2) = 10^16`
     * Fires `PrecisionMultiplierSet` event.
     * Only ADMIN can call this function.
     * > Multiplier should be less or equal to 10^18 and greater than 0!
     * @param multiplier The multiplier to set
     */
    function setPrecisionMultiplier(
        bytes32 domainHash,
        uint256 multiplier
    ) public override onlyOwnerOrOperator(domainHash) {
        require(multiplier != 0, "ZNSCurvePricer: precisionMultiplier cannot be 0");
        require(multiplier <= 10**18, "ZNSCurvePricer: precisionMultiplier cannot be greater than 10^18");
        priceConfigs[domainHash].precisionMultiplier = multiplier;

        emit PrecisionMultiplierSet(domainHash, multiplier);
    }

    /**
     * @notice Sets the fee percentage for domain registration.
     * @dev Fee percentage is set according to the basis of 10000, outlined in ``PERCENTAGE_BASIS``.
     * Fires ``FeePercentageSet`` event.
     * Only ADMIN can call this function.
     * @param feePercentage The fee percentage to set
     */
    function setFeePercentage(bytes32 domainHash, uint256 feePercentage)
    external
    override
    onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].feePercentage = feePercentage;
        emit FeePercentageSet(domainHash, feePercentage);
    }

    function setRegistry(address registry_) external override(ARegistryWired, IZNSCurvePricer) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Internal function to calculate price based on the config set,
     * and the length of the domain label.
     * @dev Before we calculate the price, 3 different cases are possible:
     * 1. `baseLength` is 0, which means we are returning `maxPrice` as a specific price for all domains
     * 2. `length` is less than or equal to `baseLength`, which means a domain will cost `maxPrice`
     * 3. `length` is greater than `maxLength`, which means a domain will cost `minPrice`
     *
     * The formula itself creates an asymptotic curve that decreases in pricing based on domain name length,
     * base length and max price, the result is divided by the precision multiplier to remove numbers beyond
     * what we care about, then multiplied by the same precision multiplier to get the actual value
     * with truncated values past precision. So having a value of `15.235234324234512365 * 10^18`
     * with precision `2` would give us `15.230000000000000000 * 10^18`
     * @param length The length of the domain name
     */
    function _getPrice(
        bytes32 parentHash,
        uint256 length
    ) internal view returns (uint256) {
        DomainPriceConfig memory config = priceConfigs[parentHash];

        // Setting baseLength to 0 indicates to the system that we are
        // currently in a special phase where we define an exact price for all domains
        // e.g. promotions or sales
        if (config.baseLength == 0) return config.maxPrice;
        if (length <= config.baseLength) return config.maxPrice;
        if (length > config.maxLength) return config.minPrice;

        return
        (config.baseLength * config.maxPrice / length)
        / config.precisionMultiplier * config.precisionMultiplier;
    }

    /**
     * @notice Internal function called every time we set props of `priceConfigs[domainHash]`
     * to make sure that values being set can not disrupt the price curve or zero out prices
     * for domains. If this validation fails, function will revert.
     * @dev We are checking here for possible price spike at `maxLength`
     * which can occur if some of the config values are not properly chosen and set.
     */
    // TODO sub fee: figure out these this logic! it doesn't work when we try and set the price to 0 !!!
    // TODO sub fee: currently it fails if we set maxPrice + baseLength as 0s
    function _validateConfig(bytes32 domainHash) internal view {
        uint256 prevToMinPrice = _getPrice(domainHash, priceConfigs[domainHash].maxLength - 1);
        require(
            priceConfigs[domainHash].minPrice <= prevToMinPrice,
            "ZNSCurvePricer: incorrect value set causes the price spike at maxLength."
        );
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The new implementation contract to upgrade to.
     */
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
