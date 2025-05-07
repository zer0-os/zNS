// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ICurvePriceConfig } from "../types/ICurvePriceConfig.sol";
import { IZNSPricer } from "../types/IZNSPricer.sol";


interface IZNSCurvePricer is ICurvePriceConfig, IZNSPricer {
    /**
     * @notice Reverted when multiplier passed by the domain owner
     * is equal to 0 or more than 10^18, which is too large.
     */
    error InvalidPrecisionMultiplierPassed();

    /**
     * @notice Reverted when domain owner is trying to set it's stake fee percentage
     * higher than 100% (uint256 "10,000").
     */
    error FeePercentageValueTooLarge(uint256 feePercentage, uint256 maximum);

    /**
     * @notice Reverted when `maxLength` smaller than `baseLength`.
     */
    error MaxLengthSmallerThanBaseLength();

    /**
     * @notice Reverted when `curveMultiplier` AND `baseLength` are 0.
     */
    error DivisionByZero();

    function initialize(
        address accessController_,
        address registry_
    ) external;

    function setRegistry(address registry_) external;

    function encodeConfig(
        CurvePriceConfig calldata config
    ) external returns(bytes memory);


    function decodePriceConfig(
        bytes memory priceConfig
    ) external returns(CurvePriceConfig memory);
}
