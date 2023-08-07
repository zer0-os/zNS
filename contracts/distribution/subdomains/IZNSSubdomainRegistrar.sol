// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IDistributionConfig } from "./IDistributionConfig.sol";
import { AZNSPricing } from "./abstractions/AZNSPricing.sol";
import { AZNSPayment } from "./abstractions/AZNSPayment.sol";


interface IZNSSubdomainRegistrar is IDistributionConfig {
    event PricingContractSet(bytes32 indexed domainHash, address indexed priceContract);
    event PaymentContractSet(bytes32 indexed domainHash, address indexed paymentContract);
    event AccessTypeSet(bytes32 indexed domainHash, AccessType accessType);
    event WhitelistUpdated(bytes32 indexed domainHash, address indexed registrant, bool allowed);
    event RootRegistrarSet(address registrar);

    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        DistributionConfig calldata configForSubdomains
    ) external;

    function revokeSubdomain(bytes32 parentHash, bytes32 domainHash) external;

    function hashWithParent(
        bytes32 parentHash,
        string calldata label
    ) external pure returns (bytes32);

    function setDistributionConfigForDomain(
        bytes32 parentHash,
        DistributionConfig calldata config
    ) external;

    function setPricingContractForDomain(
        bytes32 domainHash,
        AZNSPricing pricingContract
    ) external;

    function setPaymentContractForDomain(
        bytes32 domainHash,
        AZNSPayment paymentContract
    ) external;

    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) external;

    function setWhitelistForDomain(
        bytes32 domainHash,
        address registrant,
        bool allowed
    ) external;

    function setRegistry(address registry_) external;

    function setRootRegistrar(address registrar_) external;

    function getAccessController() external view returns (address);

    function setAccessController(address accessController_) external;
}
