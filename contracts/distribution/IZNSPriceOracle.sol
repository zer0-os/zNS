// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSPriceOracle {
    event MaxPriceSet(uint256 price);
    event MinPriceSet(uint256 price);
    event PriceMultiplierSet(uint256 multiplier);
    event BaseLengthSet(uint256 length);
    event MaxLengthSet(uint256 length);
    event PrecisionMultiplierSet(uint256 precision);
    event FeePercentageSet(uint256 feePercentage);
    event PriceConfigSet(
        uint256 maxPrice,
        uint256 minPrice,
        uint256 maxLength,
        uint256 baseLength,
        uint256 priceMultiplier,
        uint256 precisionMultiplier
    );

    /**
     * @notice Struct for each configurable price variable
     */
    struct DomainPriceConfig {
        /**
         * @notice Maximum price for a domain
        */
        uint256 maxPrice;
        /**
         * @notice Minimum price for a domain
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
         * @notice The price multiplier used in calculation for a given domain name's length
         * We store this value with two decimals of precision for division later in calculation
         * This means if we use a multiplier of 3.9, it is stored as 390
         * Note that 3.9 is recommended but is an arbitrary choice to use as a multiplier. We use
         * it here because it creates a reasonable decline in pricing visually when graphed.
         */
        uint256 priceMultiplier;
        /**
         * @notice The precision multiplier of the price. This multiplier
         * should be picked based on the number of token decimals to calculate properly.
         * e.g. if we use a token with 18 decimals, and want precision of 2,
         * our precision multiplier will be equal 10^18 - 10^2 = 10^16
         */
        // TODO ora: make this work properly
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
     * @param isRootDomain Flag for which base price to use. True for root, false for subdomains
     */
    function getPrice(
        string calldata name,
        bool isRootDomain
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

    /**
     * @notice Set the base price for root domains
     * If this value or the `priceMultiplier` value is `0` the price of any domain will also be `0`
     *
     * @param basePrice The price to set in $ZERO
     * @param isRootDomain Flag for if the price is to be set for a root or subdomain
     */
    function setMaxPrice(uint256 basePrice, bool isRootDomain) external;

    /**
     * @notice In price calculation we use a `multiplier` to adjust how steep the
     * price curve is after the base price. This allows that value to be changed.
     * If this value or the `basePrice` is `0` the price of any domain will also be `0`
     *
     * @param multiplier The new price multiplier to set
     */
    function setPriceMultiplier(uint256 multiplier) external;

    function setRegistrationFeePercentage(uint256 regFeePercentage) external;

    /**
     * @notice Set the value of the domain name length boundary where the default price applies
     * e.g. A value of '5' means all domains <= 5 in length cost the default price
     * @param length Boundary to set
     * @param isRootDomain Flag for if the price is to be set for a root or subdomain
     */
    function setBaseLength(uint256 length, bool isRootDomain) external;

    /**
     * @notice Set the value of both base lengt variables
     * @param rootLength The length for root domains
     * @param subdomainLength The length for subdomains
     */
    function setBaseLengths(uint256 rootLength, uint256 subdomainLength) external;

    function setAccessController(address accessController) external;

    function getAccessController() external view returns (address);
}
