// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IDistributionConfig } from "./IDistributionConfig.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { IZNSPricer } from "../price/IZNSPricer.sol";


/**
 * @title IZNSSubRegistrar.sol - Interface for the ZNSSubRegistrar contract responsible for registering subdomains.
 */
interface IZNSSubRegistrar is IDistributionConfig {

    /**
     * @notice Reverted when the parent is not setup with a distribution configuration
     * to sell subdomains
     * 
     * @param parentHash The parent domain hash
     */
    error ParentNotSet(bytes32 parentHash);
    
    /**
     * @notice Reverted when someone other than parent owner is trying to buy
     * a subdomain under the parent that is locked
     * or when the parent provided does not exist.
     */
    error ParentLockedOrDoesntExist(bytes32 parentHash);

    /**
     * @notice Reverted when the buyer of subdomain is not approved by the parent in it's mintlist.
     */
    error SenderNotApprovedForPurchase(bytes32 parentHash, address sender);

    /**
     * @notice Emitted when a new `DistributionConfig.pricerContract` is set for a domain.
     */
    event PricerDataSet(
        bytes32 indexed domainHash,
        bytes indexed priceConfig,
        address indexed pricerContract
    );

    /**
     * @notice Emitted when a `mintlist` is updated for a domain.
     */
    event MintlistUpdated(
        bytes32 indexed domainHash,
        uint256 indexed ownerIndex,
        address[] candidates,
        bool[] allowed
    );

    /*
     * @notice Emitted when a `mintlist` is removed for a domain by the owner or through
     * `ZNSRootRegistrar.revokeDomain()`.
     */
    event MintlistCleared(bytes32 indexed domainHash);

    /**
     * @notice Emitted when the ZNSRootRegistrar address is set in state.
     */
    event RootRegistrarSet(address registrar);

    function isMintlistedForDomain(
        bytes32 domainHash,
        address candidate
    ) external view returns (bool);

    function initialize(
        address _accessController,
        address _registry,
        address _rootRegistrar
    ) external;

    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        string calldata tokenURI,
        DistributionConfig calldata configForSubdomains,
        PaymentConfig calldata paymentConfig
    ) external returns (bytes32);

    function hashWithParent(
        bytes32 parentHash,
        string calldata label
    ) external pure returns (bytes32);

    function setDistributionConfigForDomain(
        bytes32 parentHash,
        DistributionConfig calldata config
    ) external;

    function setPricerDataForDomain(
        bytes32 domainHash,
        bytes memory priceConfig,
        IZNSPricer pricerContract
    ) external;

    function setPaymentTypeForDomain(
        bytes32 domainHash,
        PaymentType paymentType
    ) external;

    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) external;

    function updateMintlistForDomain(
        bytes32 domainHash,
        address[] calldata candidates,
        bool[] calldata allowed
    ) external;

    function clearMintlistForDomain(bytes32 domainHash) external;

    function clearMintlistAndLock(bytes32 domainHash) external;

    function setRegistry(address registry_) external;

    function setRootRegistrar(address registrar_) external;
}
