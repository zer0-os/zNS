// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSPriceOracle } from "./IZNSPriceOracle.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";


/**
 * @title Implementation of the Price Oracle, module that calculates the price of a domain
 * based on its length and the rules set by Zero ADMIN.
 */
contract ZNSPriceOracle is AAccessControlled, UUPSUpgradeable, IZNSPriceOracle {
    using StringUtils for string;

    /**
     * @notice Value used as a basis for percentage calculations,
     * since Solidity does not support fractions.
     */
    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice Struct for each configurable price variable
     * that participates in the price calculation.
     * @dev See [IZNSPriceOracle.md](./IZNSPriceOracle.md) for more details.
     */
    DomainPriceConfig public rootDomainPriceConfig;

    /**
     * @notice Proxy initializer to set the initial state of the contract after deployment.
     * Only ADMIN can call this function.
     * @dev > Note the for DomainPriceConfig we set each value individually and calling
     * 2 important functions that validate all of the config's values against the formula:
     * - `setPrecisionMultiplier()` to validate precision multiplier
     * - `_validateConfig()` to validate the whole config in order to avoid price spikes
     * @param accessController_ the address of the ZNSAccessController contract.
     * @param priceConfig_ a number of variables that participate in the price calculation.
     */
    function initialize(
        address accessController_,
        DomainPriceConfig calldata priceConfig_
    ) public override initializer {
        _setAccessController(accessController_);

        setPriceConfig(priceConfig_);
    }

    /**
     * @notice Get the price of a given domain name
     * @param name The name of the domain to check
     */
    function getPrice(
        string calldata name
    ) external view override returns (
        uint256 totalPrice,
        uint256 domainPrice,
        uint256 fee
    ) {
        uint256 length = name.strlen();
        // No pricing is set for 0 length domains
        if (length == 0) return (0, 0, 0);

        domainPrice = _getPrice(length);
        fee = getProtocolFee(domainPrice);

        totalPrice = domainPrice + fee;
    }

    /**
     * @notice Get the registration fee amount in `stakingToken` for a specific domain price
     * as `domainPrice * rootDomainPriceConfig.feePercentage / PERCENTAGE_BASIS`.
     * @param domainPrice The price of the domain
     */
    function getProtocolFee(uint256 domainPrice) public view override returns (uint256) {
        return (domainPrice * rootDomainPriceConfig.feePercentage) / PERCENTAGE_BASIS;
    }

    /**
     * @notice Setter for `rootDomainPriceConfig`. Only ADMIN can call this function.
     * @dev Validates the value of the `precisionMultiplier` and the whole config in order to avoid price spikes,
     * fires `PriceConfigSet` event.
     * Only ADMIN can call this function.
     * @param priceConfig The new price config to set
     */
    function setPriceConfig(DomainPriceConfig calldata priceConfig) public override onlyAdmin {
        rootDomainPriceConfig.baseLength = priceConfig.baseLength;
        rootDomainPriceConfig.maxPrice = priceConfig.maxPrice;
        rootDomainPriceConfig.minPrice = priceConfig.minPrice;
        rootDomainPriceConfig.maxLength = priceConfig.maxLength;
        rootDomainPriceConfig.feePercentage = priceConfig.feePercentage;
        setPrecisionMultiplier(priceConfig.precisionMultiplier);

        _validateConfig();

        emit PriceConfigSet(
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
        uint256 maxPrice
    ) external override onlyAdmin {
        rootDomainPriceConfig.maxPrice = maxPrice;

        if (maxPrice != 0) _validateConfig();

        emit MaxPriceSet(maxPrice);
    }

    /**
     * @notice Sets the minimum price for domains. Validates the config with the new price.
     * Fires `MinPriceSet` event.
     * Only ADMIN can call this function.
     * @param minPrice The minimum price to set in $ZERO
     */
    function setMinPrice(
        uint256 minPrice
    ) external override onlyAdmin {
        rootDomainPriceConfig.minPrice = minPrice;

        _validateConfig();

        emit MinPriceSet(minPrice);
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
        uint256 length
    ) external override onlyAdmin {
        rootDomainPriceConfig.baseLength = length;

        _validateConfig();

        emit BaseLengthSet(length);
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
        uint256 length
    ) external override onlyAdmin {
        rootDomainPriceConfig.maxLength = length;

        if (length != 0) _validateConfig();

        emit MaxLengthSet(length);
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
        uint256 multiplier
    ) public override onlyAdmin {
        require(multiplier != 0, "ZNSPriceOracle: precisionMultiplier cannot be 0");
        require(multiplier <= 10**18, "ZNSPriceOracle: precisionMultiplier cannot be greater than 10^18");
        rootDomainPriceConfig.precisionMultiplier = multiplier;

        emit PrecisionMultiplierSet(multiplier);
    }

    /**
     * @notice Sets the fee percentage for domain registration.
     * @dev Fee percentage is set according to the basis of 10000, outlined in ``PERCENTAGE_BASIS``.
     * Fires ``FeePercentageSet`` event.
     * Only ADMIN can call this function.
     * @param regFeePercentage The fee percentage to set
     */
    function setRegistrationFeePercentage(uint256 regFeePercentage)
    external
    override
    onlyAdmin {
        rootDomainPriceConfig.feePercentage = regFeePercentage;
        emit FeePercentageSet(regFeePercentage);
    }

    /**
     * @notice Sets the access controller for the contract.
     * Only ADMIN can call this function.
     * Fires `AccessControllerSet` event.
     * @param accessController_ The address of the new access controller
     */
    function setAccessController(address accessController_)
    external
    override(AAccessControlled, IZNSPriceOracle)
    onlyAdmin {
        _setAccessController(accessController_);
    }

    /**
     * @notice Getter for ZNSAccessController address stored on this contract.
     */
    function getAccessController() external view override(AAccessControlled, IZNSPriceOracle) returns (address) {
        return address(accessController);
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
        uint256 length
    ) internal view returns (uint256) {
        DomainPriceConfig memory config = rootDomainPriceConfig;

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
     * @notice Internal function called every time we set props of `rootDomainPriceConfig`
     * to make sure that values being set can not disrupt the price curve or zero out prices
     * for domains. If this validation fails, function will revert.
     * @dev We are checking here for possible price spike at `maxLength`
     * which can occur if some of the config values are not properly chosen and set.
     */
    // TODO sub fee: figure out these this logic! it doesn't work when we try and set the price to 0 !!!
    // TODO sub fee: HERE and in AsymptoticPricing !!!
    // TODO sub fee: currently it fails if we set maxPrice + baseLength as 0s
    function _validateConfig() internal view {
        uint256 prevToMinPrice = _getPrice(rootDomainPriceConfig.maxLength - 1);
        require(
            rootDomainPriceConfig.minPrice <= prevToMinPrice,
            "ZNSPriceOracle: incorrect value set causes the price spike at maxLength."
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
