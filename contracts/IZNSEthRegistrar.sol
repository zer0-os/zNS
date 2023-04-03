// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSEthRegistrar {

    // TODO: what other params do we need here for all the events ??
    event RootDomainRegistered(bytes32 indexed domainHash, string name, address indexed registrant);
    event SubdomainRegistered(bytes32 indexed domainHash, bytes32 indexed parentHash, string name, address indexed registrant);
    event DomainRevoked(bytes32 indexed domainHash, string name, address indexed registrant);

    function hashWithParent(bytes32 parentHash, string name) external pure returns (bytes32);

    function registerRootDomain(string name, address resolver, address domainContent) external returns (bytes32);

    function approveSubdomain(bytes32 parentHash, address subdomainOwner) external;

    function registerSubdomain(
        bytes32 parentHash,
        string name,
        address beneficiary,
        address resolver,
        address domainAddress
    ) external returns (bytes32);

    function revokeDomain(bytes32 domainHash) external;
}
