// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSEthRegistrar {
    // TODO: what other params do we need here for all the events ??

    event DomainRegistered(
        bytes32 indexed parentHash,
        bytes32 indexed domainHash,
        uint256 tokenId,
        string name,
        address indexed registrant,
        address resolver
    );

    event SubdomainApprovalSet(
        bytes32 indexed parentHash,
        address indexed user,
        bool indexed status
    );

    event DomainRevoked(bytes32 indexed domainHash, address indexed registrant);

    event DomainReclaimed(bytes32 indexed domainHash, address indexed registrant);

    event ZnsRegistrySet(address znsRegistry);

    event ZnsTreasurySet(address znsTreasury);

    event ZnsDomainTokenSet(address znsDomainToken);

    event ZnsAddressResolverSet(address znsAddressResolver);

    function registerRootDomain(
        string calldata name,
        address resolver,
        address domainContent
    ) external returns (bytes32);

    function setSubdomainApproval(
        bytes32 parentHash,
        address user,
        bool status
    ) external;

    function registerSubdomain(
        bytes32 parentHash,
        string calldata name,
        address registrant,
        address resolver,
        address domainAddress
    ) external returns (bytes32);

    function revokeDomain(bytes32 domainHash) external;

    function reclaimDomain(bytes32 domainHash) external;

    function hashWithParent(
      bytes32 parentHash,
      string calldata name
    ) external pure returns (bytes32);

    function setZnsRegistry(address znsRegistry_) external;

    function setZnsTreasury(address znsTreasury_) external;

    function setZnsDomainToken(address znsDomainToken_) external;

    function setZnsAddressResolver(address znsAddressResolver_) external;

  function setAccessController(address accessController_) external;
}
