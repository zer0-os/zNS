// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSPriceOracle } from "./IZNSPriceOracle.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { AccessControlled } from "../access/AccessControlled.sol";


contract ZNSPriceOracle is AccessControlled, UUPSUpgradeable, IZNSPriceOracle {
    using StringUtils for string;

    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice Struct for each configurable price variable
     */
    DomainPriceConfig public rootDomainPriceConfig;

    /**
     * @notice The registration fee value in percentage as basis points (parts per 10,000)
     *  so the 2% value would be represented as 200.
     *  See {getRegistrationFee} for the actual fee calc process.
     */
    uint256 public feePercentage;

    function initialize(
        address accessController_,
        DomainPriceConfig calldata priceConfig_,
        uint256 regFeePercentage_
    ) public override initializer {
        _setAccessController(accessController_);

        // Set the values of the priceConfig struct
        rootDomainPriceConfig.baseLength = priceConfig_.baseLength;
        rootDomainPriceConfig.maxPrice = priceConfig_.maxPrice;
        rootDomainPriceConfig.minPrice = priceConfig_.minPrice;
        rootDomainPriceConfig.maxLength = priceConfig_.maxLength;
        setPrecisionMultiplier(priceConfig_.precisionMultiplier);

        _validateConfig();

        feePercentage = regFeePercentage_;
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
        fee = getRegistrationFee(domainPrice);

        totalPrice = domainPrice + fee;
    }

    function getRegistrationFee(uint256 domainPrice) public view override returns (uint256) {
        return (domainPrice * feePercentage) / PERCENTAGE_BASIS;
    }

    // TODO: add docs on how to properly set maxLength vs other values
    //  so that we do not have minPrice higher than the price of the previous
    //  value
    function setPriceConfig(DomainPriceConfig calldata priceConfig) external override onlyAdmin {
        rootDomainPriceConfig.baseLength = priceConfig.baseLength;
        rootDomainPriceConfig.maxPrice = priceConfig.maxPrice;
        rootDomainPriceConfig.minPrice = priceConfig.minPrice;
        rootDomainPriceConfig.maxLength = priceConfig.maxLength;
        setPrecisionMultiplier(priceConfig.precisionMultiplier);

        _validateConfig();

        emit PriceConfigSet(
            priceConfig.maxPrice,
            priceConfig.minPrice,
            priceConfig.maxLength,
            priceConfig.baseLength,
            priceConfig.precisionMultiplier
        );
    }

    /**
     * @notice Set the max price for root domains or subdomains.
     *
     * @param maxPrice The price to set in $ZERO
     */
    function setMaxPrice(
        uint256 maxPrice
    ) external override onlyAdmin {
        rootDomainPriceConfig.maxPrice = maxPrice;

        _validateConfig();

        emit MaxPriceSet(maxPrice);
    }

    function setMinPrice(
        uint256 minPrice
    ) external override onlyAdmin {
        rootDomainPriceConfig.minPrice = minPrice;

        _validateConfig();

        emit MinPriceSet(minPrice);
    }

    /**
     * @notice Set the value of the domain name length boundary where the default price applies
     * e.g. A value of '5' means all domains <= 5 in length cost the default price
     * @param length Boundary to set
     */
    function setBaseLength(
        uint256 length
    ) external override onlyAdmin {
        rootDomainPriceConfig.baseLength = length;

        _validateConfig();

        emit BaseLengthSet(length);
    }

    function setMaxLength(
        uint256 length
    ) external override onlyAdmin {
        rootDomainPriceConfig.maxLength = length;

        _validateConfig();

        emit MaxLengthSet(length);
    }

    /**
     * @notice Set the precision multiplier for the price calculation.
     * @param multiplier This should be picked based on the number of token decimals
     * to calculate properly.
     * e.g. if we use a token with 18 decimals, and want precision of 2,
     * our precision multiplier will be equal to 10^18 - 10^2 = 10^16
     */
    function setPrecisionMultiplier(
        uint256 multiplier
    ) public override onlyAdmin {
        require(multiplier != 0, "ZNSPriceOracle: precisionMultiplier cannot be 0");
        require(multiplier < 10**18, "ZNSPriceOracle: precisionMultiplier cannot be greater than 10^18");
        rootDomainPriceConfig.precisionMultiplier = multiplier;

        emit PrecisionMultiplierSet(multiplier);
    }

    function setRegistrationFeePercentage(uint256 regFeePercentage)
    external
    override
    onlyAdmin {
        feePercentage = regFeePercentage;
        emit FeePercentageSet(regFeePercentage);
    }

    function setAccessController(address accessController_)
    external
    override(AccessControlled, IZNSPriceOracle)
    onlyAdmin {
        _setAccessController(accessController_);
    }

    function getAccessController() external view override(AccessControlled, IZNSPriceOracle) returns (address) {
        return address(accessController);
    }

    /**
     * @notice Internal function to get price abstract of the base price being for
     * a root domain or a subdomain.
     *
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

        // This creates an asymptotic curve that decreases in pricing based on domain name length
        // then divide it by the precision multiplier to remove numbers beyond what we care about
        // Then multiply by the same precision multiplier to get the actual value
        // with truncated values past precision. So having a value of 15.235234324234512365 * 10^18
        // with precision 2 would give us 15.230000000000000000 * 10^18
        return
        (config.baseLength * config.maxPrice / length)
        / config.precisionMultiplier * config.precisionMultiplier;
    }

    function _validateConfig() internal view {
        uint256 prevToMinPrice = _getPrice(rootDomainPriceConfig.maxLength - 1);
        require(
            rootDomainPriceConfig.minPrice < prevToMinPrice,
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
