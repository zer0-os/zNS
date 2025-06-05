// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSFixedPricer } from "./IZNSFixedPricer.sol";
import { StringUtils } from "../utils/StringUtils.sol";

/**
 * @notice Pricer contract that uses the most straightforward fixed pricing model
 * that doesn't depend on the length of the label.
*/
contract ZNSFixedPricer is IZNSFixedPricer {
    using StringUtils for string;

    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice Real encoding happens off chain, but we keep this here as a
     * helper function for users to ensure that their data is correct
     *
     * @param config The price to encode
     */
    function encodeConfig(
        FixedPriceConfig memory config
    ) external pure override returns (bytes memory) {
        return abi.encodePacked(
            config.price,
            config.feePercentage
        );
    }

    function decodePriceConfig(
        bytes memory priceConfig
    ) public pure override returns (FixedPriceConfig memory) {
        _checkLength(priceConfig);

        (
            uint256 price,
            uint256 feePercentage
        ) = abi.decode(priceConfig, (uint256, uint256));

        FixedPriceConfig memory config = FixedPriceConfig(
            price,
            feePercentage
        );

        return config;
    }

    /**
     * @notice Gets the price for a subdomain candidate label under the parent domain.
     * @dev `skipValidityCheck` param is added to provide proper revert when the user is
     * calling this to find out the price of a domain that is not valid. But in Registrar contracts
     * we want to do this explicitly and before we get the price to have lower tx cost for reverted tx.
     * So Registrars will pass this bool as "true" to not repeat the validity check.
     * Note that if calling this function directly to find out the price, a user should always pass "false"
     * as `skipValidityCheck` param, otherwise, the price will be returned for an invalid label that is not
     * possible to register.
     * @param parentPriceConfig The hash of the parent domain to check the price under
     * @param label The label of the subdomain candidate to check the price for
     * @param skipValidityCheck If true, skips the validity check for the label
    */
    // solhint-disable-next-line no-unused-vars
    function getPrice(
        bytes memory parentPriceConfig,
        string calldata label,
        bool skipValidityCheck
    ) public override pure returns (uint256) {
        if (!skipValidityCheck) {
            // Confirms string values are only [a-z0-9-]
            label.validate();
        }

        return decodePriceConfig(parentPriceConfig).price;
    }

    /**
     * @notice Verify that the given price config is valid for this pricer
     * @param priceConfig The price config to validate
     */
    function validatePriceConfig(bytes memory priceConfig) external override pure {
        _checkLength(priceConfig);

        FixedPriceConfig memory config = decodePriceConfig(priceConfig);

        if (config.feePercentage > PERCENTAGE_BASIS)
            revert FeePercentageValueTooLarge(
                config.feePercentage,
                PERCENTAGE_BASIS
            );
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. It returns fee for a given price
     * based on the value set by the owner of the parent domain.
     * @param parentPriceConfig The hash of the parent domain under which fee is determined
     * @param price The price for a domain
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
     * @param parentPriceConfig The price config of the parent domain under which price and fee are determined
     * @param label The label of the subdomain candidate to get the price and fee for before/during registration
     * @param skipValidityCheck If true, skips the validity check for the label
    */
    function getPriceAndFee(
        bytes memory parentPriceConfig,
        string calldata label,
        bool skipValidityCheck
    ) external pure override returns (uint256 price, uint256 fee) {
        // To match the IZNSPricer interface, we have unused params here
        FixedPriceConfig memory config = decodePriceConfig(parentPriceConfig);
        return (
            config.price,
            _getFeeForPrice(config.feePercentage, config.price)
        );
    }

    ////////////////////////
    //// INTERNAL FUNCS ////
    ////////////////////////

    function _checkLength(bytes memory priceConfig) internal pure {
        // 2 props * 32 bytes each = 64 bytes
        if (priceConfig.length != 64) {
            revert IncorrectPriceConfigLength();
        }
    }

    function _getFeeForPrice(
        uint256 feePercentage,
        uint256 price
    ) internal pure returns (uint256) {
        return (price * feePercentage) / PERCENTAGE_BASIS;
    }
}
