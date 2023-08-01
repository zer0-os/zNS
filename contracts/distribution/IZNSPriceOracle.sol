// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IDomainPriceConfig } from "../abstractions/IDomainPriceConfig.sol";


interface IZNSPriceOracle is IDomainPriceConfig {

    /**
     * @notice Emitted when the `maxPrice` is set in `rootDomainPriceConfig`
     * @param price The new maxPrice value
     */
    event MaxPriceSet(uint256 price);

    /**
     * @notice Emitted when the `minPrice` is set in `rootDomainPriceConfig`
     * @param price The new minPrice value
     */
    event MinPriceSet(uint256 price);

    /**
     * @notice Emitted when the `baseLength` is set in `rootDomainPriceConfig`
     * @param length The new baseLength value
     */
    event BaseLengthSet(uint256 length);

    /**
     * @notice Emitted when the `maxLength` is set in `rootDomainPriceConfig`
     * @param length The new maxLength value
     */
    event MaxLengthSet(uint256 length);

    /**
     * @notice Emitted when the `precisionMultiplier` is set in `rootDomainPriceConfig`
     * @param precision The new precisionMultiplier value
     */
    event PrecisionMultiplierSet(uint256 precision);

    /**
     * @notice Emitted when the `feePercentage` is set in state
     * @param feePercentage The new feePercentage value
     */
    event FeePercentageSet(uint256 feePercentage);

    /**
     * @notice Emitted when the full `rootDomainPriceConfig` is set in state
     * @param maxPrice The new `maxPrice` value
     * @param minPrice The new `minPrice` value
     * @param maxLength The new `maxLength` value
     * @param baseLength The new `baseLength` value
     * @param precisionMultiplier The new `precisionMultiplier` value
     */
    event PriceConfigSet(
        uint256 maxPrice,
        uint256 minPrice,
        uint256 maxLength,
        uint256 baseLength,
        uint256 precisionMultiplier,
        uint256 feePercentage
    );

    function initialize(
        address accessController_,
        DomainPriceConfig calldata priceConfig_
    ) external;

    function getPrice(
        string calldata name
    ) external view returns (
        uint256 totalPrice,
        uint256 domainPrice,
        uint256 fee
    );

    function getRegistrationFee(uint256 domainPrice) external view returns (uint256);

    function setPriceConfig(DomainPriceConfig calldata priceConfig) external;

    function setMaxPrice(uint256 maxPrice) external;

    function setMinPrice(uint256 minPrice) external;

    function setBaseLength(uint256 length) external;

    function setMaxLength(uint256 length) external;

    function setPrecisionMultiplier(uint256 multiplier) external;

    function setRegistrationFeePercentage(uint256 regFeePercentage) external;

    function setAccessController(address accessController) external;

    function getAccessController() external view returns (address);
}
