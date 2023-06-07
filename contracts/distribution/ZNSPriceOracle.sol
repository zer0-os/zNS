// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
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
    // TODO ora: rework and add more setters for every single var
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
        // Set pricing and length parameters
        rootDomainPriceConfig = priceConfig_;
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

    function setPriceConfig(DomainPriceConfig calldata priceConfig) external override onlyAdmin {
        require(priceConfig.precisionMultiplier != 0, "ZNSPriceOracle: precisionMultiplier cannot be 0");

        rootDomainPriceConfig = priceConfig;

        emit PriceConfigSet(
            priceConfig.maxPrice,
            priceConfig.minPrice,
            priceConfig.maxLength,
            priceConfig.baseLength,
            priceConfig.priceMultiplier,
            priceConfig.precisionMultiplier
        );
    }

    /**
     * @notice Set the max price for root domains or subdomains. If this value or the
     * `priceMultiplier` value is `0` the price of any domain will also be `0`
     *
     * @param maxPrice The price to set in $ZERO
     */
    function setMaxPrice(
        uint256 maxPrice
    ) external override onlyAdmin {
        rootDomainPriceConfig.maxPrice = maxPrice;

        emit MaxPriceSet(maxPrice);
    }

    function setMinPrice(
        uint256 minPrice
    ) external override onlyAdmin {
        rootDomainPriceConfig.minPrice = minPrice;

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

        emit BaseLengthSet(length);
    }

    function setMaxLength(
        uint256 length
    ) external override onlyAdmin {
        rootDomainPriceConfig.maxLength = length;

        emit MaxLengthSet(length);
    }

    /**
     * @notice In price calculation we use a `multiplier` to adjust how steep the
     * price curve is after the base price. This allows that value to be changed.
     * If this value or the `maxPrice` is `0` the price of any domain will also be `0`
     *
     * Valid values for the multiplier range are between 300 - 400 inclusively.
     * These are decimal values with two points of precision, meaning they are really 3.00 - 4.00
     * but we can't store them this way. We divide by 100 in the below internal price function
     * to make up for this.
     * @param multiplier The new price multiplier to set
     */
    function setPriceMultiplier(uint256 multiplier) external override onlyAdmin {
        require(
            multiplier >= 300 && multiplier <= 400,
            "ZNSPriceOracle: Multiplier out of range"
        );
        rootDomainPriceConfig.priceMultiplier = multiplier;

        emit PriceMultiplierSet(multiplier);
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
    ) external override onlyAdmin {
        require(multiplier != 0, "ZNSPriceOracle: precisionMultiplier cannot be 0");
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

    function setAccessController(address accessController)
    external
    override(AccessControlled, IZNSPriceOracle)
    onlyAdmin {
        _setAccessController(accessController);
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

        if (length <= config.baseLength) return config.maxPrice;
        if (length > config.maxLength) return config.minPrice;

        // This creates an asymptotic curve that decreases in pricing based on domain name length
        // Because there are no decimal fractions in Solidity we set the muliplier as 100x higher
        // than it is meant to be, so we divide by 100 to reverse that action here.
        // = (baseLength * maxPrice * multiplier)/(length + (3 * multiplier)
        // we then divide it by the precision multiplier to remove numbers
        // past chose precision we don't care about
        // we then multiply by the same precision multiplier to get the actual value
        // with truncated values past precision
        // so having a value of 15.235234324234512365 * 10^18 with precision 2
        // would give us 15.230000000000000000 * 10^18
        return
        (config.baseLength * config.priceMultiplier * config.maxPrice)
        / (length + (3 * config.priceMultiplier)) / 100
        / config.precisionMultiplier * config.precisionMultiplier;
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
