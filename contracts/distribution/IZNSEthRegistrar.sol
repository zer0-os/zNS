// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSEthRegistrar {
    event DomainRegistered(
        bytes32 indexed domainHash,
        uint256 indexed tokenId,
        string name,
        address indexed registrant,
        address resolver
    );

    event DomainRevoked(bytes32 indexed domainHash, address indexed registrant);

    event DomainReclaimed(
        bytes32 indexed domainHash,
        address indexed registrant
    );

    // TODO AC: remove ZNS from names here and in state vars
    event ZnsRegistrySet(address znsRegistry);

    event ZnsTreasurySet(address znsTreasury);

    event ZnsDomainTokenSet(address znsDomainToken);

    event ZnsAddressResolverSet(address znsAddressResolver);

    function registerDomain(
        string calldata name,
        address domainContent
    ) external returns (bytes32);

    function revokeDomain(bytes32 domainHash) external;

    function reclaimDomain(bytes32 domainHash) external;

    function setZnsRegistry(address znsRegistry_) external;

    function setZnsTreasury(address znsTreasury_) external;

    function setZnsDomainToken(address znsDomainToken_) external;

    function setZnsAddressResolver(address znsAddressResolver_) external;

    function setAccessController(address accessController_) external;
}
