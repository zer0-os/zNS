// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IZNSAddressResolver.sol";
import "./IZNSRegistry.sol";

contract ZNSAddressResolver is ERC165, IZNSAddressResolver {
  IZNSRegistry public registry; /// @notice IZNSRegistry
  mapping(bytes32 => address) private addressOf; /// @notice mapping of domain hash to address

  constructor(IZNSRegistry _registry) {
    registry = _registry;
  }

  /**
   * @dev Revert if `msg.sender` is not the owner or an operator allowed by the owner
   * @param domainNameHash The identifying hash of a domain's name
   */
  modifier onlyOwnerOrOperator(bytes32 domainNameHash) {
    address owner = registry.getDomainRecord(domainNameHash).owner;
    require(
      msg.sender == owner || registry.isAllowedOperator(owner, msg.sender),
      "ZNS: Not allowed"
    );
    _;
  }

  /**
   * @dev Resolves address given domain name hash
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getAddress(bytes32 domainNameHash) external view returns (address) {
    return addressOf[domainNameHash];
  }

  /**
   * @dev Sets the address of a domain name hash, only registry
   * @param domainNameHash The identifying hash of a domain's name
   * @param newAddress The new domain owner
   */
  function setAddress(
    bytes32 domainNameHash,
    address newAddress
  ) external onlyOwnerOrOperator(domainNameHash) {
    addressOf[domainNameHash] = newAddress;

    emit AddressSet(domainNameHash, newAddress);
  }

  /**
   * @dev ERC-165 check for implementation identifier
   * @dev Supports interfaces IZNSAddressResolver and IERC165
   * @param interfaceId ID to check, XOR of the first 4 bytes of each function signature
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(ERC165, IZNSAddressResolver) returns (bool) {
    return
      interfaceId == getInterfaceId() || super.supportsInterface(interfaceId);
  }

  /**
   * @dev Exposes IZNSAddressResolver interfaceId
   */
  function getInterfaceId() public pure returns (bytes4) {
    return type(IZNSAddressResolver).interfaceId;
  }
}
