// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IDistributionConfig } from "../types/IDistributionConfig.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { IZNSPricerCommon } from "../types/IZNSPricerCommon.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IZNSSubRegistrar is IDistributionConfig {
    event PricerContractSet(bytes32 indexed domainHash, address indexed priceContract);
    event PaymentTypeSet(bytes32 indexed domainHash, PaymentType paymentType);
    event AccessTypeSet(bytes32 indexed domainHash, AccessType accessType);
    event DistributionConfigSet(
        bytes32 indexed domainHash,
        IZNSPricerCommon pricerContract,
        PaymentType paymentType,
        AccessType accessType
    );
    event MintlistUpdated(
        bytes32 indexed domainHash,
        address[] candidates,
        bool[] allowed
    );
    event RootRegistrarSet(address registrar);

    function distrConfigs(
        bytes32 domainHash
    ) external view returns (
        IZNSPricerCommon pricerContract,
        PaymentType paymentType,
        AccessType accessType
    );

    function mintlist(
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

    function setPricerContractForDomain(
        bytes32 domainHash,
        IZNSPricerCommon pricerContract
    ) external;

    function setPaymentTypeForDomain(
        bytes32 domainHash,
        PaymentType paymentType
    ) external;

    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) external;

    function setMintlistForDomain(
        bytes32 domainHash,
        address[] calldata candidates,
        bool[] calldata allowed
    ) external;

    function setRegistry(address registry_) external;

    function setRootRegistrar(address registrar_) external;
}
