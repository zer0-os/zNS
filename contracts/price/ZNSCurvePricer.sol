// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSCurvePricer } from "./IZNSCurvePricer.sol";
import { StringUtils } from "../utils/StringUtils.sol";


/**
 * @title Implementation of the Curve Pricing, a module that calculates the price of a domain
 * based on its length and the rules set by Zero ADMIN.
 * This module uses a hyperbolic curve that starts at (`baseLength`; `maxPrice`)
 * for all domains <= `baseLength`.
 * Then the price is reduced using the price calculation function below.
 * All prices after `maxLength` are fixed and equal the price at `maxLength`.
 *
 * @dev This contract is stateless as all the other Pricer contracts.
 */
contract ZNSCurvePricer is IZNSCurvePricer {
    using StringUtils for string;

    /**
     * @notice Value used as a basis for percentage calculations,
     * since Solidity does not support fractions.
     */
    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice Multiply the entire hyperbola formula by this number to be able to reduce the `curveMultiplier`
     * by 3 digits, which gives us more flexibility in defining the hyperbola function.
     *
     * @dev > Canot be "0".
     */
    uint256 public constant FACTOR_SCALE = 1000;

    /**
     * @notice Encode a given `CurvePriceConfig` struct into bytes
     *
     * @param config The `CurvePriceConfig` to encode into bytes
     */
    function encodeConfig(
        CurvePriceConfig calldata config
    ) external pure override returns (bytes memory) {
        return
            abi.encodePacked(
                config.maxPrice,
                config.curveMultiplier,
                config.maxLength,
                config.baseLength,
                config.precisionMultiplier,
                config.feePercentage
            );
    }

    /**
     * @notice Decode bytes into a `CurvePriceConfig` struct
     *
     * @param priceConfig The bytes to decode
     */
    function decodePriceConfig(
        bytes memory priceConfig
    ) public pure override returns (CurvePriceConfig memory) {
        _checkLength(priceConfig);

        (
            uint256 maxPrice,
            uint256 curveMultiplier,
            uint256 maxLength,
            uint256 baseLength,
            uint256 precisionMultiplier,
            uint256 feePercentage
        ) = abi.decode(
            priceConfig,
            (
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256
            )
        );

        return CurvePriceConfig({
            maxPrice: maxPrice,
            curveMultiplier: curveMultiplier,
            maxLength: maxLength,
            baseLength: baseLength,
            precisionMultiplier: precisionMultiplier,
            feePercentage: feePercentage
        });
    }

    /**
     * @notice Validate the inputs for each variable in a price config
     * @dev Will revert if incoming config is invalid
     *
     * @param priceConfig The price config to evaluate
     */
    function validatePriceConfig(
        bytes memory priceConfig
    ) public override pure {
        _checkLength(priceConfig);
        _validatePriceConfig(decodePriceConfig(priceConfig));
    }

    /**
     * @notice Get the price of a given domain name
     *
     * @dev `skipValidityCheck` param is added to provide proper revert when the user is
     * calling this to find out the price of a domain that is not valid. But in Registrar contracts
     * we want to do this explicitly and before we get the price to have lower tx cost for reverted tx.
     * So Registrars will pass this bool as "true" to not repeat the validity check.
     * Note that if calling this function directly to find out the price, a user should always pass "false"
     * as `skipValidityCheck` param, otherwise, the price will be returned for an invalid label that is not
     * possible to register.
     *
     * @param parentPriceConfig The hash of the parent domain under which price is determined
     * @param label The label of the subdomain candidate to get the price for before/during registration
     * @param skipValidityCheck If true, skips the validity check for the label
     */
    function getPrice(
        bytes memory parentPriceConfig,
        string calldata label,
        bool skipValidityCheck
    ) public pure override returns (uint256) {
        CurvePriceConfig memory config = decodePriceConfig(parentPriceConfig);

        if (!skipValidityCheck) {
            // Confirms string values are only [a-z0-9-]
            label.validate();
        }

        return _getPrice(config, label.strlen());
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. It returns fee for a given price
     * based on the value set by the owner of the parent domain.
     *
     * @param parentPriceConfig The price config in bytes of the parent domain under which fee is determined
     * @param price The price to get the fee for
    */
    function getFeeForPrice(
        bytes memory parentPriceConfig,
        uint256 price
    ) public pure override returns (uint256) {
        return _getFeeForPrice(
            decodePriceConfig(parentPriceConfig).feePercentage,
            price
        );
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. Returns both price and fee for a given label
     * under the given parent.
     *
     * @param parentPriceConfig The price config in bytes of the parent domain under which fee is determined
     * @param label The label of the subdomain candidate to get the price and fee for before/during registration
    */
    function getPriceAndFee(
        bytes calldata parentPriceConfig,
        string calldata label,
        bool skipValidityCheck
    ) external pure override returns (uint256 price, uint256 stakeFee) {
        if (!skipValidityCheck) {
            label.validate();
        }

        price = _getPrice(
            decodePriceConfig(parentPriceConfig),
            label.strlen()
        );

        stakeFee = getFeeForPrice(parentPriceConfig, price);

        return (price, stakeFee);
    }

    ////////////////////////
    //// INTERNAL FUNCS ////
    ////////////////////////

    function _checkLength(bytes memory priceConfig) internal pure {
        // 6 props * 32 bytes each = 192 bytes
        if (priceConfig.length != 192) {
            revert IncorrectPriceConfigLength();
        }
    }

    function _getFeeForPrice(uint256 feePercentage, uint256 price) internal pure returns (uint256) {
        return (price * feePercentage) / PERCENTAGE_BASIS;
    }

    function _validatePriceConfig(CurvePriceConfig memory config) internal pure {
        if (config.curveMultiplier == 0 && config.baseLength == 0)
            revert DivisionByZero();

        if (config.maxLength < config.baseLength || config.maxLength == 0)
            revert MaxLengthSmallerThanBaseLength();

        if (config.precisionMultiplier == 0 || config.precisionMultiplier > 10**18)
            revert InvalidPrecisionMultiplierPassed();

        if (config.feePercentage > PERCENTAGE_BASIS)
            revert FeePercentageValueTooLarge(
                config.feePercentage,
                PERCENTAGE_BASIS
            );
    }

    /**
     * @notice Internal function to calculate price based on the config set,
     * and the length of the domain label.
     *
     * @dev Before we calculate the price, 6 different cases are possible:
     * 1. `maxPrice` is 0, which means all subdomains under this parent are free
     * 2. `baseLength` is 0, which means prices for all domains = 0 (free).
     * 3. `length` is less or equal to `baseLength`, which means a domain will cost `maxPrice`
     * 4. `length` is greater than `maxLength`, which means a domain will cost price by fomula at `maxLength`
     * 5. The numerator can be less than the denominator, which is achieved by setting a huge value
     * for `curveMultiplier` or by decreasing the `baseLength` and `maxPrice`, which means all domains
     * which are longer than `baseLength` will be free.
     * 6. `curveMultiplier` is 0, which means all domains will cost `maxPrice`.
     *
     * The formula itself creates an hyperbolic curve that decreases in pricing based on domain name length,
     * base length, max price and curve multiplier.
     * `FACTOR_SCALE` allows to perceive `curveMultiplier` as fraction number in regular formula,
     * which helps to bend a curve of the price chart.
     * The result is divided by the precision multiplier to remove numbers beyond
     * what we care about, then multiplied by the same precision multiplier to get the actual value
     * with truncated values past precision. So having a value of `15.235234324234512365 * 10^18`
     * with precision `2` would give us `15.230000000000000000 * 10^18`
     *
     * @param config The parent price config
     * @param length The length of the domain name
     */
    function _getPrice(
        CurvePriceConfig memory config,
        uint256 length
    ) internal pure returns (uint256) {
        // We use `maxPrice` as 0 to indicate free domains
        if (config.maxPrice == 0 || config.baseLength == 0) return 0;

        if (length == 0) return 0;

        // Setting baseLength to 0 indicates to the system that we are
        // currently in a special phase where we define an exact price for all domains
        // e.g. promotions or sales
        if (length <= config.baseLength) return config.maxPrice;

        if (length > config.maxLength) length = config.maxLength;

        uint256 rawPrice = (config.baseLength * config.maxPrice * FACTOR_SCALE) /
            (config.baseLength * FACTOR_SCALE + config.curveMultiplier * (length - config.baseLength));

        rawPrice = rawPrice < config.precisionMultiplier
            ? config.precisionMultiplier
            : rawPrice;

        return rawPrice / config.precisionMultiplier * config.precisionMultiplier;
    }
}
