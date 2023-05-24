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
        address domainContent
    ) external returns (bytes32);

    function revokeDomain(bytes32 domainHash) external;

    function reclaimDomain(bytes32 domainHash) external;

    function setRegistry(address znsRegistry_) external;

    function setTreasury(address znsTreasury_) external;

    function setDomainToken(address znsDomainToken_) external;

    function setAddressResolver(address znsAddressResolver_) external;

    function setAccessController(address accessController_) external;

    function getAccessController() external view returns (address);
}
