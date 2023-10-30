// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { IZNSFixedPricer } from "./IZNSFixedPricer.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


/**
 * @notice Pricer contract that uses the most straightforward fixed pricing model
 * that doesn't depend on the length of the label.
*/
contract ZNSFixedPricer is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSFixedPricer {

    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice Mapping of domainHash to price config set by the domain owner/operator
    */
    mapping(bytes32 domainHash => PriceConfig config) public priceConfigs;

    function initialize(address _accessController, address _registry) external override initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    // TODO audit question: should we add onlyProxy modifiers for every function in proxied contracts ??
    /**
     * @notice Sets the price for a domain. Only callable by domain owner/operator. Emits a `PriceSet` event.
     * @param domainHash The hash of the domain who sets the price for subdomains
     * @param _price The new price value set
    */
    function setPrice(bytes32 domainHash, uint256 _price) public override onlyOwnerOrOperator(domainHash) {
        _setPrice(domainHash, _price);
    }

    /**
     * @notice Gets the price for a subdomain candidate label under the parent domain.
     * @param parentHash The hash of the parent domain to check the price under
     * @param label The label of the subdomain candidate to check the price for
    */
    // solhint-disable-next-line no-unused-vars
    function getPrice(bytes32 parentHash, string calldata label) public override view returns (uint256) {
        return priceConfigs[parentHash].price;
    }

    /**
     * @notice Sets the feePercentage for a domain. Only callable by domain owner/operator. 
     * Emits a `FeePercentageSet` event.
     * @dev `feePercentage` is set as a part of the `PERCENTAGE_BASIS` of 10,000 where 1% = 100
     * @param domainHash The hash of the domain who sets the feePercentage for subdomains
     * @param feePercentage The new feePercentage value set
    */
    function setFeePercentage(
        bytes32 domainHash,
        uint256 feePercentage
    ) public override onlyOwnerOrOperator(domainHash) {
        _setFeePercentage(domainHash, feePercentage);
    }

    /**
     * @notice Setter for `priceConfigs[domainHash]`. Only domain owner/operator can call this function.
     * @dev Sets both `PriceConfig.price` and `PriceConfig.feePercentage` in one call, fires `PriceSet`
     * and `FeePercentageSet` events.
     * @param domainHash The domain hash to set the price config for
     * @param priceConfig The new price config to set
     */
    function setPriceConfig(
        bytes32 domainHash,
        PriceConfig calldata priceConfig
    ) external override {
        setPrice(domainHash, priceConfig.price);
        setFeePercentage(domainHash, priceConfig.feePercentage);
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. It returns fee for a given price
     * based on the value set by the owner of the parent domain.
     * @param parentHash The hash of the parent domain under which fee is determined
     * @param price The price to get the fee for
    */
    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) public view override returns (uint256) {
        return (price * priceConfigs[parentHash].feePercentage) / PERCENTAGE_BASIS;
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. Returns both price and fee for a given label
     * under the given parent.
     * @param parentHash The hash of the parent domain under which price and fee are determined
     * @param label The label of the subdomain candidate to get the price and fee for before/during registration
    */
    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label
    ) external view override returns (uint256 price, uint256 fee) {
        price = getPrice(parentHash, label);
        fee = getFeeForPrice(parentHash, price);
        return (price, fee);
    }

    /**
     * @notice Sets the registry address in state.
     * @dev This function is required for all contracts inheriting `ARegistryWired`.
    */
    function setRegistry(address registry_) public override(ARegistryWired, IZNSFixedPricer) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Internal function for set price
     * @param domainHash The hash of the domain
     * @param price The new price
     */
    function _setPrice(bytes32 domainHash, uint256 price) internal {
        priceConfigs[domainHash].price = price;
        emit PriceSet(domainHash, price);
    }

    /**
     * @notice Internal function for setFeePercentage
     * @param domainHash The hash of the domain
     * @param feePercentage The new feePercentage
     */
    function _setFeePercentage(bytes32 domainHash, uint256 feePercentage) internal {
        priceConfigs[domainHash].feePercentage = feePercentage;
        emit FeePercentageSet(domainHash, feePercentage);
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
