// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


/**
 * @title IZNSPricer.sol
 *
 * @notice Base interface required to be inherited by all Pricing contracts to work with zNS
 */
interface IZNSPricer {
    /**
     * @notice Emitted when the given price config is not the expected length
     */
    error IncorrectPriceConfigLength();

    /**
     * @notice Reverted when domain owner is trying to set it's stake fee percentage
     * higher than 100% (uint256 "10,000").
     */
    error FeePercentageValueTooLarge(uint256 feePercentage, uint256 maximum);

    /**
     * @dev `skipValidityCheck` param is added to provide proper revert when the user is
     * calling this to find out the price of a domain that is not valid. But in Registrar contracts
     * we want to do this explicitly and before we get the price to have lower tx cost for reverted tx.
     * So Registrars will pass this bool as "true" to not repeat the validity check.
     * Note that if calling this function directly to find out the price, a user should always pass "false"
     * as `skipValidityCheck` param, otherwise, the price will be returned for an invalid label that is not
     * possible to register.
     *
     * @param parentPriceConfig The abi encoded price config of the parent domain under which price is determined
     *  This stored somewhere else (e.g. SubRegistrar) and passed here, since Pricer contracts are stateless.
     * @param label The label of the subdomain candidate to get the price for. Only used in pricers
     *  where price depends on the label length.
     * @param skipValidityCheck If "true", skips the validity check for the label, if "false" will fail
     *  for invalid labels.
     */
    function getPrice(
        bytes memory parentPriceConfig,
        string calldata label,
        bool skipValidityCheck
    ) external pure returns (uint256);

    /**
     * @dev Fees are only supported for `PaymentType.STAKE` !
     *  This function will NOT be called if `PaymentType` != `PaymentType.STAKE`
     *  Instead `getPrice()` will be called.
     */
    function getPriceAndFee(
        bytes memory parentPriceConfig,
        string calldata label,
        bool skipValidityCheck
    ) external pure returns (uint256 price, uint256 fee);

    /**
     * @notice Returns the fee for a given price and parent price config.
     *
     * @dev Fees are only supported for `PaymentType.STAKE` !
     */
    function getFeeForPrice(
        bytes memory parentPriceConfig,
        uint256 price
    ) external pure returns (uint256);

    /**
     * @notice Validate a given encoded price config before storing it somewhere.
     *
     * @param priceConfig The price config to validate
     */
    function validatePriceConfig(
        bytes memory priceConfig
    ) external pure;
}
