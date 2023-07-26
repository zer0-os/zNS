// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "./abstractions/AZNSPricing.sol";
import { AZNSPayment } from "./abstractions/AZNSPayment.sol";
import { IZNSRegistry } from "../../registry/IZNSRegistry.sol";
import { IZNSRegistrar } from "../IZNSRegistrar.sol";


// TODO sub: create an interface for this contract !!
contract ZNSSubdomainRegistrar {

    event SubdomainRegistered(
        bytes32 indexed parentHash,
        bytes32 indexed subdomainHash,
        string label,
        uint256 tokenId,
        address registrant,
        // TODO sub: do we need this?
        address resolver,
        address subdomainAddress
    );

    IZNSRegistry public registry;
    // TODO sub: change name of Registrar var and the contract also
    IZNSRegistrar public mainRegistrar;

    enum AccessType {
        LOCKED,
        OPEN,
        WHITELIST
    }

    struct DistributionConfig {
        AZNSPricing pricingContract;
        AZNSPayment paymentContract;
        AccessType accessType;
    }

    // TODO sub: make better name AND for the setter function !
    mapping(bytes32 domainHash => DistributionConfig) public parentRules;

    mapping(bytes32 domainHash =>
        mapping(address registrant => bool allowed)
    ) public distributionWhitelist;

    // TODO sub: proxy ??
    constructor(address _registry, address _registrar) {
        require(
            _registry != address(0),
            "ZNSSubdomainRegistrar: _registry can not be 0x0 address"
        );
        // TODO sub: remove when refactored !
        require(
            _registrar != address(0),
            "ZNSSubdomainRegistrar: _registrar can not be 0x0 address"
        );
        registry = IZNSRegistry(_registry);
        mainRegistrar = IZNSRegistrar(_registrar);
    }

    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        DistributionConfig calldata configForSubdomains
    ) external {
        // TODO sub: make the order of ops better
        DistributionConfig memory parentConfig = parentRules[parentHash];
        require(
            parentConfig.accessType != AccessType.LOCKED
                || registry.isOwnerOrOperator(parentHash, msg.sender),
            "ZNSSubdomainRegistrar: Parent domain's distribution is locked"
        );

        if (parentConfig.accessType == AccessType.WHITELIST) {
            require(
                distributionWhitelist[parentHash][msg.sender],
                "ZNSSubdomainRegistrar: Sender is not whitelisted"
            );
        }

        bytes32 subdomainHash = hashWithParent(parentHash, label);

        require(
            !registry.exists(subdomainHash),
            "ZNSSubdomainRegistrar: Domain already exists"
        );

        uint256 price = AZNSPricing(parentConfig.pricingContract)
            .getPrice(parentHash, label);

        AZNSPayment(parentConfig.paymentContract).processPayment(
            parentHash,
            msg.sender,
            price
        );

        // TODO sub: what is the best way to do this ??
        //      so that it can be done for root domain also
        setParentRules(subdomainHash, configForSubdomains);

        mainRegistrar.settleRegistration(
            parentHash,
            subdomainHash,
            label,
            msg.sender,
            domainAddress
        );
    }

    function hashWithParent(
        bytes32 parentHash,
        string calldata name
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                parentHash,
                keccak256(bytes(name))
            )
        );
    }

    // TODO sub: access control
    function setParentRules(
        bytes32 parentHash,
        DistributionConfig calldata config
    ) public {
        // TODO sub: expand!
        parentRules[parentHash] = config;
    }
}
