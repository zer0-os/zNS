// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { IZNSFixedPricer } from "./IZNSFixedPricer.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { StringUtils } from "../utils/StringUtils.sol";


/**
 * @notice Pricer contract that uses the most straightforward fixed pricing model
 * that doesn't depend on the length of the label.
*/
contract ZNSFixedPricer is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSFixedPricer {
    using StringUtils for string;

    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice Mapping of domainHash to price config set by the domain owner/operator
    */
    // mapping(bytes32 domainHash => PriceConfig config) public priceConfigs;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _accessController, address _registry) external override initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    /**
     * @notice Real encoding happens off chain, but we keep this here as a
     * helper function for users to ensure that their data is correct
     * 
     * @param config The price to encode
     */
    function encodeConfig(
        PriceConfig memory config
    ) external pure returns(bytes memory) {
        // TODO necessary to have this if only single var?
        bytes32 price = bytes32(config.price);
        bytes32 feePercentage = bytes32(config.feePercentage);
        bytes32 isSet = bytes32(abi.encode(config.isSet)); // TODO maybe dont need?

        return abi.encodePacked(
            price,
            feePercentage,
            isSet
        );
    }

    function _decodePriceConfig(
        bytes memory priceConfig
    ) internal pure returns(PriceConfig memory) {
        (
            uint256 price,
            uint256 feePercentage,
            bool isSet
        ) = abi.decode(priceConfig, (uint256, uint256, bool));

        PriceConfig memory config = PriceConfig(
            price,
            feePercentage,
            isSet
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

        PriceConfig memory config = _decodePriceConfig(parentPriceConfig);

        return config.price;
    }

    function validatePriceConfig(bytes memory priceConfig) external pure {
        // TODO
        // not really needed for single variable pricers
        // but to fulfill interface IZNSPricer we must define this
        // decode like curvepricer, then modify validators in same way
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. It returns fee for a given price
     * based on the value set by the owner of the parent domain.
     * @param parentPriceConfig The hash of the parent domain under which fee is determined
    */
    function getFeeForPrice(
        bytes memory parentPriceConfig
    ) public pure override returns (uint256) {
        PriceConfig memory config = _decodePriceConfig(parentPriceConfig);
        return (config.price * config.feePercentage) / PERCENTAGE_BASIS;
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. Returns both price and fee for a given label
     * under the given parent.
     * @param parentHash The hash of the parent domain under which price and fee are determined
     * @param label The label of the subdomain candidate to get the price and fee for before/during registration
     * @param skipValidityCheck If true, skips the validity check for the label
    */
    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label,
        bool skipValidityCheck
    ) external view override returns (uint256 price, uint256 fee) {
        // price = getPrice(parentHash, label, skipValidityCheck);
        // fee = getFeeForPrice(parentHash, price);
        // return (price, fee);
    }

    /**
     * @notice Sets the registry address in state.
     * @dev This function is required for all contracts inheriting `ARegistryWired`.
    */
    function setRegistry(address registry_) public override(ARegistryWired, IZNSFixedPricer) onlyAdmin {
        _setRegistry(registry_);
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
