// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IDistributionConfig } from "../types/IDistributionConfig.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IEIP712Helper } from "./IEIP712Helper.sol";

/**
 * @title IZNSSubRegistrar.sol - Interface for the ZNSSubRegistrar contract responsible for registering subdomains.
*/
interface IZNSSubRegistrar is IDistributionConfig {

    struct RegistrationArgs {
        bytes32 parentHash;
        string label;
        string tokenURI;
        address domainAddress;
    }

    /**
     * @notice Emitted when a new `DistributionConfig.pricerContract` is set for a domain.
    */
    event PricerContractSet(bytes32 indexed domainHash, address indexed pricerContract);

    /**
     * @notice Emitted when a new `DistributionConfig.paymentType` is set for a domain.
    */
    event PaymentTypeSet(bytes32 indexed domainHash, PaymentType paymentType);

    /**
     * @notice Emitted when a new `DistributionConfig.accessType` is set for a domain.
    */
    event AccessTypeSet(bytes32 indexed domainHash, AccessType accessType);

    /**
     * @notice Emitted when a new full `DistributionConfig` is set for a domain at once.
    */
    event DistributionConfigSet(
        bytes32 indexed domainHash,
        IZNSPricer pricerContract,
        PaymentType paymentType,
        AccessType accessType
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

    function distrConfigs(
        bytes32 domainHash
    ) external view returns (
        IZNSPricer pricerContract,
        PaymentType paymentType,
        AccessType accessType
    );

    function initialize(
        address accessController,
        address registry,
        address rootRegistrar,
        address eip712Helper
    ) external;

    function registerSubdomain(
        RegistrationArgs calldata args,
        DistributionConfig calldata distrConfig,
        PaymentConfig calldata paymentConfig,
        bytes calldata signature
    ) external returns (bytes32);

    function hashWithParent(
        bytes32 parentHash,
        string calldata label
    ) external pure returns (bytes32);

    function recoverSigner(
        IEIP712Helper.Coupon memory coupon,
        bytes memory signature
    ) external view returns (address);

    function setDistributionConfigForDomain(
        bytes32 parentHash,
        DistributionConfig calldata config
    ) external;

    function setPricerContractForDomain(
        bytes32 domainHash,
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

    function setRegistry(address registry) external;

    function setEIP712Helper(address helper) external;

    function setRootRegistrar(address registrar) external;
}
