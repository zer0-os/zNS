// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSPriceOracle {

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
        uint256 precisionMultiplier
    );

    /**
     * @notice Struct for each configurable variable for price calculations.
     * Does NOT include variables for calcs of registration fees.
     */
    struct DomainPriceConfig {
        /**
         * @notice Maximum price for a domain returned at <= `baseLength`
        */
        uint256 maxPrice;
        /**
         * @notice Minimum price for a domain returned at > `maxLength`
         */
        uint256 minPrice;
        /**
         * @notice Maximum length of a domain name. If the name is longer than this
         * value we return the `minPrice`
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
    }

    function initialize(
        address accessController_,
        DomainPriceConfig calldata priceConfig_,
        uint256 regFeePercentage_
    ) external;

    /**
     * @notice Get the price of a given domain name length
     * @param name The name of the domain to check
     */
    function getPrice(
        string calldata name
    ) external view returns (
        uint256 totalPrice,
        uint256 domainPrice,
        uint256 fee
    );

    /**
     * @notice Returns the registration fee based on domain price
     * @param domainPrice Price of the domain in question
     */
    function getRegistrationFee(uint256 domainPrice) external view returns (uint256);

    function setPriceConfig(DomainPriceConfig calldata priceConfig) external;

    /**
     * @notice Set the base price for root domains
     *
     * @param maxPrice The price to set in $ZERO
     */
    function setMaxPrice(uint256 maxPrice) external;

    function setMinPrice(uint256 minPrice) external;

    /**
     * @notice Set the value of the domain name length boundary where the default price applies
     * e.g. A value of '5' means all domains <= 5 in length cost the default price
     * @param length Boundary to set
     */
    function setBaseLength(uint256 length) external;

    function setMaxLength(uint256 length) external;

    function setPrecisionMultiplier(uint256 multiplier) external;

    function setRegistrationFeePercentage(uint256 regFeePercentage) external;

    function setAccessController(address accessController) external;

    function getAccessController() external view returns (address);
}
