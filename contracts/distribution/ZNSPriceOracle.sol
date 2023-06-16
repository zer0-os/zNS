// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSPriceOracle } from "./IZNSPriceOracle.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { AccessControlled } from "../access/AccessControlled.sol";


contract ZNSPriceOracle is AccessControlled, UUPSUpgradeable, IZNSPriceOracle {
    using StringUtils for string;

    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice The registration fee value in percentage as basis points (parts per 10,000)
     *  so the 2% value would be represented as 200.
     *  See {getRegistrationFee} for the actual fee calc process.
     */
    uint256 public feePercentage;

    /**
     * @notice Struct for each configurable price variable
     */
    // TODO: rework and add more setters for every single var
    PriceParams public priceConfig;

    // TODO: rework setters here for a better structure!
    // TODO: remove subdomain logic

    function initialize(
        address accessController_,
        PriceParams calldata priceConfig_,
        uint256 regFeePercentage_
    ) public override initializer {
        _setAccessController(accessController_);
        // Set pricing and length parameters
        priceConfig = priceConfig_;
        feePercentage = regFeePercentage_;
    }

    /**
     * @notice Get the price of a given domain name
     * @param name The name of the domain to check
     * @param isRootDomain Flag for which base price to use. True for root, false for subdomains
     */
    function getPrice(
        string calldata name,
        bool isRootDomain
    ) external view override returns (
        uint256 totalPrice,
        uint256 domainPrice,
        uint256 fee
    ) {
        uint256 length = name.strlen();
        // No pricing is set for 0 length domains
        if (length == 0) return (0, 0, 0);

        if (isRootDomain) {
            domainPrice = _getPrice(
                length,
                priceConfig.baseRootDomainLength,
                priceConfig.maxRootDomainPrice,
                priceConfig.maxRootDomainLength,
                priceConfig.minRootDomainPrice
            );
        } else {
            domainPrice = _getPrice(
                length,
                priceConfig.baseSubdomainLength,
                priceConfig.maxSubdomainPrice,
                priceConfig.maxSubdomainLength,
                priceConfig.minSubdomainPrice
            );
        }

        fee = getRegistrationFee(domainPrice);
        totalPrice = domainPrice + fee;
    }

    function getRegistrationFee(uint256 domainPrice) public view override returns (uint256) {
        return (domainPrice * feePercentage) / PERCENTAGE_BASIS;
    }

    /**
     * @notice Set the max price for root domains or subdomains. If this value or the
     * `priceMultiplier` value is `0` the price of any domain will also be `0`
     *
     * @param maxPrice The price to set in $ZERO
     * @param isRootDomain Flag for if the price is to be set for a root or subdomain
     */
    function setMaxPrice(
        uint256 maxPrice,
        bool isRootDomain
    ) external override onlyAdmin {
        if (isRootDomain) {
            priceConfig.maxRootDomainPrice = maxPrice;
        } else {
            priceConfig.maxSubdomainPrice = maxPrice;
        }

        emit BasePriceSet(maxPrice, isRootDomain);
    }

    // TODO reg: function setMaxPrices(root, subdomains)

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
        priceConfig.priceMultiplier = multiplier;

        emit PriceMultiplierSet(multiplier);
    }

    function setRegistrationFeePercentage(uint256 regFeePercentage)
    external
    override
    onlyAdmin
    {
        feePercentage = regFeePercentage;
        emit FeePercentageSet(regFeePercentage);
    }

    /**
     * @notice Set the value of the domain name length boundary where the default price applies
     * e.g. A value of '5' means all domains <= 5 in length cost the default price
     * @param length Boundary to set
     * @param isRootDomain Flag for if the price is to be set for a root or subdomain
     */
    // TODO reg: make these 2 functions better when removing subdomain logic
    function setBaseLength(
        uint256 length,
        bool isRootDomain
    ) external override onlyAdmin {
        if (isRootDomain) {
            priceConfig.baseRootDomainLength = length;
        } else {
            priceConfig.baseSubdomainLength = length;
        }

        emit BaseLengthSet(length, isRootDomain);
    }

    /**
     * @notice Set the value of both base lengt variables
     * @param rootLength The length for root domains
     * @param subdomainLength The length for subdomains
     */
    function setBaseLengths(
        uint256 rootLength,
        uint256 subdomainLength
    ) external override onlyAdmin {
        priceConfig.baseRootDomainLength = rootLength;
        priceConfig.baseSubdomainLength = subdomainLength;

        emit BaseLengthsSet(rootLength, subdomainLength);
    }

    function setAccessController(address accessController_)
    external
    override(AccessControlled, IZNSPriceOracle)
    onlyAdmin
    {
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
     * @param baseLength The base length to reach before we actually do the calculation
     * @param maxPrice The base price to calculate with
     * @param maxLength The maximum length of a name before turning the minimum price
     * @param minPrice The minimum price for that domain category
     */
    function _getPrice(
        uint256 length,
        uint256 baseLength,
        uint256 maxPrice,
        uint256 maxLength,
        uint256 minPrice
    ) internal view returns (uint256) {
        if (length <= baseLength) return maxPrice;
        if (length > maxLength) return minPrice;

        // Pull into memory to save external calls to storage
        uint256 multiplier = priceConfig.priceMultiplier;

        // TODO truncate to everything after the decimal, we don't want fractional prices
        // Should this be here vs. in the dApp?

        // This creates an asymptotic curve that decreases in pricing based on domain name length
        // Because there are no decimals in ETH we set the muliplier as 100x higher
        // than it is meant to be, so we divide by 100 to reverse that action here.
        // = (baseLength * maxPrice * multiplier)/(length + (3 * multiplier)
        return
        (baseLength * multiplier * maxPrice) /
        (length + (3 * multiplier)) /
        100;
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
