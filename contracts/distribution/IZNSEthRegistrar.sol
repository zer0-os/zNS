// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSEthRegistrar {
  // TODO: what other params do we need here for all the events ??
  event RootDomainRegistered(
    bytes32 indexed domainHash,
    uint256 tokenId,
    string name,
    address indexed registrant,
    address resolver
  );
  event SubdomainRegistered(
    bytes32 indexed domainHash,
    bytes32 indexed parentHash,
    uint256 tokenId,
    string name,
    address indexed registrant,
    address resolver
  );
  event SubdomainApproved(
    bytes32 indexed parentHash,
    address indexed ownerCandidate
  );
  event DomainRevoked(bytes32 indexed domainHash, address indexed registrant);

  function registerRootDomain(
    string calldata name,
    address resolver,
    address domainContent
  ) external returns (bytes32);

  function approveSubdomain(
    bytes32 parentHash,
    address subdomainOwner
  ) external;

  function registerSubdomain(
    bytes32 parentHash,
    string calldata name,
    address registrant,
    address resolver,
    address domainAddress
  ) external returns (bytes32);

  function revokeDomain(bytes32 domainHash) external;
}
