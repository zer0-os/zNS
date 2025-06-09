// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSPricer } from "./IZNSPricer.sol";


interface IZNSCurvePricer is IZNSPricer {

    /**
     * @notice Struct for each configurable variable for price and fee calculations.
     */
    struct CurvePriceConfig {
        /**
         * @notice Maximum price for a domain returned at <= `baseLength`
         */
        uint256 maxPrice;
        /**
         * @notice Multiplier which we use to bend the price curve in interval from `baseLength` to `maxLength`.
         */
        uint256 curveMultiplier;
        /**
         * @notice Maximum length of a domain name. If the name is longer than this
         * value we return the price that was at the `maxLength`
         */
        uint256 maxLength;
        /**
         * @notice Base length of a domain name. If the name is less than or equal to
         * this value we return the `maxPrice`
         */
        uint256 baseLength;
        /**
         * @notice The precision multiplier of the price. This multiplier
         * should be picked based on the number of token decimals to calculate properly.
         * e.g. if we use a token with 18 decimals, and want precision of 2,
         * our precision multiplier will be equal 10^18 - 10^2 = 10^16
         */
        uint256 precisionMultiplier;
        /**
         * @notice The registration fee value in percentage as basis points (parts per 10,000)
         *  so the 2% value would be represented as 200.
         *  See [getRegistrationFee](#getregistrationfee) for the actual fee calc process.
         */
        uint256 feePercentage;
    }

    /**
     * @notice Reverted when multiplier passed by the domain owner
     * is equal to 0 or more than 10^18, which is too large.
     */
    error InvalidPrecisionMultiplierPassed();

    /**
     * @notice Reverted when `maxLength` smaller than `baseLength`.
     */
    error MaxLengthSmallerThanBaseLength();

    /**
     * @notice Reverted when `curveMultiplier` AND `baseLength` are 0.
     */
    error DivisionByZero();

    function encodeConfig(
        CurvePriceConfig calldata config
    ) external pure returns (bytes memory);


    function decodePriceConfig(
        bytes memory priceConfig
    ) external pure returns (CurvePriceConfig memory);
}
