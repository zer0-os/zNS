// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


contract ZNSSubdomainRegistrar {

    enum AccessType {
        LOCKED,
        OPEN,
        WHITELIST
    }

    // ?? - not good for extensibility
    enum PricingType {
        FREE,
        FLAT,
        ASYMPTOTIC,
        LINEAR
    }

    // ??
    enum PaymentsType {
        DIRECT,
        TTL,
        STAKING
    }

    struct DistributionConfig {
        IZNSPricing pricingContract;
        IZNSPayments paymentsContract;
        AccessType accessType;
    }

    mapping(bytes32 => DistributionConfig) public parentRules;

    mapping(bytes32 => mapping(address => bool)) public distributionWhitelist;


    function registerSubdomain(
        bytes32 parentHash,
        string calldata name,
        DistributionConfig calldata configForSubdomain
    ) external {
        // TODO sub: make the order of ops better
        DistributionConfig memory parentConfig = parentRules[parentHash];
        require(
            parentConfig.accessType != AccessType.LOCKED,
            "Parent domain is locked"
        );

        if (parentConfig.accessType == AccessType.WHITELIST) {
            require(
                distributionWhitelist[parentHash][msg.sender],
                "Sender is not whitelisted"
            );
        }

        bytes32 subdomainHash = keccak256(
            abi.encodePacked(
                parentHash,
                keccak256(bytes(name))
            )
        );

        require(
            !registry.exists(domainHash),
            "ZNSRegistrar: Domain already exists"
        );

        uint256 price = IZNSPricing(subdomainConfig.pricingContract)
            .getPrice(name);

        IZNSPayments(subdomainConfig.paymentsContract).processPayment(price);

        uint256 tokenId = uint256(subdomainHash);
        domainToken.register(msg.sender, tokenId);

        // TODO sub: include setting the config for the subdomain
        _setDomainData();

        emit SubdomainRegistered();
    }
}
