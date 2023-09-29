// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { IZNSFixedPricer } from "./IZNSFixedPricer.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


contract ZNSFixedPricer is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSFixedPricer {

    uint256 public constant PERCENTAGE_BASIS = 10000;

    mapping(bytes32 domainHash => PriceConfig config) public priceConfigs;

    function initialize(address _accessController, address _registry) external override initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    // TODO sub: should we add onlyProxy modifiers for every function ??
    function setPrice(bytes32 domainHash, uint256 _price) public override onlyOwnerOrOperator(domainHash) {
        _setPrice(domainHash, _price);
    }

    /**
     * @notice Get the price of a domain before minting it
     * @param parentHash The hash of the parent domain
     * @param label The string label of the domain
     */
    // solhint-disable-next-line no-unused-vars
    function getPrice(bytes32 parentHash, string calldata label) public override view returns (uint256) {
        return priceConfigs[parentHash].price;
    }

    /**
     * @notice Set the fee percentage of the price for registration
     * @param domainHash The hash of the applicable domain
     * @param feePercentage The fee to set
     */
    function setFeePercentage(
        bytes32 domainHash,
        uint256 feePercentage
    ) public override onlyOwnerOrOperator(domainHash) {
        _setFeePercentage(domainHash, feePercentage);
    }

    /**
     * @notice Return the fee for a domain's price
     * @param parentHash The hash of the domain
     * @param price The price of the domain
     */
    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) public view override returns (uint256) {
        return (price * priceConfigs[parentHash].feePercentage) / PERCENTAGE_BASIS;
    }

    /**
     * @notice Get both the price and fee individually for a domain registration
     * @param parentHash The hash of the parent domain
     * @param label The string label of the domain to be minted
     * @return price The price of that domain
     * @return fee The fee associated with the price of registration
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
     * @notice Set the price configuration for a domain
     * @param domainHash The hash of the domain
     * @param priceConfig The new price configuration
     */
    function setPriceConfig(
        bytes32 domainHash,
        PriceConfig calldata priceConfig
    ) external override {
        _setPrice(domainHash, priceConfig.price);
        _setFeePercentage(domainHash, priceConfig.feePercentage);
    }

    /**
     * @notice Set a new registry to be used
     * @param registry_ The new registry
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
