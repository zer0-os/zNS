// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "./abstractions/AZNSPricing.sol";
import { AZNSPayment } from "./abstractions/AZNSPayment.sol";
import { IZNSRegistry } from "../../registry/IZNSRegistry.sol";
// TODO sub:
import "../../token/IZNSDomainToken.sol";


contract ZNSSubdomainRegistrar {

    IZNSRegistry public registry;
    // TODO sub: do we need a token here?
    IZNSDomainToken public domainToken;

    enum AccessType {
        LOCKED,
        OPEN,
        WHITELIST
    }

    struct DistributionConfig {
        AZNSPricing pricingContract;
        AZNSPayment paymentsContract;
        AccessType accessType;
    }

    // TODO sub: make better name AND for the setter function !
    mapping(bytes32 domainHash => DistributionConfig) public parentRules;

    mapping(bytes32 domainHash =>
        mapping(address registrant => bool allowed)
    ) public distributionWhitelist;

    // TODO sub: proxy ??
    constructor(address _registry, address _domainToken) {
        require(
            _registry != address(0),
            "ZNSSubdomainRegistrar: _registry can not be 0x0 address"
        );
        require(
            _domainToken != address(0),
            "ZNSSubdomainRegistrar: _domainToken can not be 0x0 address"
        );
        registry = IZNSRegistry(_registry);
        domainToken = IZNSDomainToken(_domainToken);
    }

    function registerSubdomain(
        bytes32 parentHash,
        string calldata name,
        // TODO sub: add logic for this
        DistributionConfig calldata configForSubdomain
    ) external {
        // TODO sub: make the order of ops better
        DistributionConfig memory parentConfig = parentRules[parentHash];
        require(
            parentConfig.accessType != AccessType.LOCKED
                || registry.isOwnerOrOperator(parentHash, msg.sender),
            "ZNSSubdomainRegistrar: Parent domain is locked"
        );

        if (parentConfig.accessType == AccessType.WHITELIST) {
            require(
                distributionWhitelist[parentHash][msg.sender],
                "ZNSSubdomainRegistrar: Sender is not whitelisted"
            );
        }

        bytes32 subdomainHash = hashWithParent(parentHash, name);

        require(
            !registry.exists(subdomainHash),
            "ZNSSubdomainRegistrar: Domain already exists"
        );

        uint256 price = AZNSPricing(parentConfig.pricingContract)
            .getPrice(parentHash, name);

        AZNSPayment(parentConfig.paymentsContract).processPayment(
            parentHash,
            msg.sender,
            price
        );

        uint256 tokenId = uint256(subdomainHash);
        domainToken.register(msg.sender, tokenId);

        // TODO sub: possibly refactor to use another Registrar
        registry.createDomainRecord(subdomainHash, msg.sender, address(0));

        // TODO sub: include setting the config for the subdomain

        // TODO sub: emit SubdomainRegistered();
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
    ) external {
        // TODO sub: expand!
        parentRules[parentHash] = config;
    }
}
