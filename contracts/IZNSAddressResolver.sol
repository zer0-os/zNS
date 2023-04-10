// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSAddressResolver {
  /**
   * @dev Emit when ownership of a domain is modified
   * @param newAddress The new domain owner
   * @param domainNameHash The identifying hash of a domain's name
   */
  event AddressSet(bytes32 indexed domainNameHash, address indexed newAddress);

  function supportsInterface(bytes4 interfaceId) external view returns (bool);

  function getAddress(bytes32 domainNameHash) external view returns (address);

  function setAddress(bytes32 domainNameHash, address newAddress) external;
}
