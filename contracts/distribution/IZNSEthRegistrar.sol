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

    function registerDomain(
        string calldata name,
        address domainContent
    ) external returns (bytes32);

    function revokeDomain(bytes32 domainHash) external;

    function reclaimDomain(bytes32 domainHash) external;
}
