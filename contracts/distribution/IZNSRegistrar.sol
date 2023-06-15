// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSRegistrar {
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

    event RegistrySet(address registry);

    event TreasurySet(address treasury);

    event DomainTokenSet(address domainToken);

    event AddressResolverSet(address addressResolver);

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

    function getAccessController() external view returns (address);

    function initialize(
        address accessController_,
        address registry_,
        address treasury_,
        address domainToken_,
        address addressResolver_
    ) external;
}
