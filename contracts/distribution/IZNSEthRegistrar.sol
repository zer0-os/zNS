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

    event RegistrySet(address znsRegistry);

    event TreasurySet(address znsTreasury);

    event DomainTokenSet(address znsDomainToken);

    event AddressResolverSet(address znsAddressResolver);

    function registerDomain(
        string calldata name,
        address resolverContent
    ) external returns (bytes32);

    function revokeDomain(bytes32 domainHash) external;

    function reclaimDomain(bytes32 domainHash) external;

    function setRegistry(address registry_) external;

    function setTreasury(address treasury_) external;

    function setDomainToken(address domainToken_) external;

    function setAddressResolver(address addressResolver_) external;

    function setAccessController(address accessController_) external;

    function initialize(
        address accessController_,
        address znsRegistry_,
        address znsTreasury_,
        address znsDomainToken_,
        address znsAddressResolver_
    ) external;
}
