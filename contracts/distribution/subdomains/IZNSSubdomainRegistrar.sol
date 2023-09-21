// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IDistributionConfig } from "./IDistributionConfig.sol";
import { AZNSPricing } from "./abstractions/AZNSPricing.sol";
import { AZNSPayment } from "./abstractions/AZNSPayment.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IZNSSubdomainRegistrar is IDistributionConfig {
    event PricingContractSet(bytes32 indexed domainHash, address indexed priceContract);
    event PaymentConfigSet(
        bytes32 indexed domainHash,
        IERC20 indexed paymentToken,
        address indexed beneficiary,
        PaymentType paymentType
    );
    event PaymentTokenSet(bytes32 indexed domainHash, address indexed paymentToken);
    event PaymentBeneficiarySet(bytes32 indexed domainHash, address indexed beneficiary);
    event PaymentTypeSet(bytes32 indexed domainHash, PaymentType paymentType);
    event AccessTypeSet(bytes32 indexed domainHash, AccessType accessType);
    event WhitelistUpdated(bytes32 indexed domainHash, address indexed registrant, bool allowed);
    event RootRegistrarSet(address registrar);

    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        DistributionConfig calldata configForSubdomains
    ) external returns (bytes32);

    function revokeSubdomain(bytes32 subdomainHash) external;

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

    function setPaymentConfigForDomain(
        bytes32 domainHash,
        PaymentConfig calldata config
    ) external;

    function setPaymentTokenForDomain(
        bytes32 domainHash,
        IERC20 paymentToken
    ) external;

    function setBeneficiaryForDomain(
        bytes32 domainHash,
        address beneficiary
    ) external;

    function setPaymentTypeForDomain(
        bytes32 domainHash,
        PaymentType paymentType
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

    function getPricingContractForDomain(bytes32 domainHash) external view returns (AZNSPricing);

    function getAccessTypeForDomain(bytes32 domainHash) external view returns (AccessType);

    function getAccessController() external view returns (address);

    function setAccessController(address accessController_) external;
}
