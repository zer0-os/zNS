// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IZNSAddressResolver.sol";
import "./IZNSRegistry.sol";

contract ZNSAddressResolver is IZNSAddressResolver {
  bytes4 internal resolverInterfaceId; /// @notice erc-165 interface ID, calculated in constructor
  IZNSRegistry public registry; /// @notice IZNSRegistry
  mapping(bytes32 => address) private addressOf; /// @notice mapping of domain hash to address

  constructor(IZNSRegistry _registry) {
    registry = _registry;
    resolverInterfaceId = calculateSelector();
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
<<<<<<< HEAD
  ) external onlyRegistry {
=======
  ) external onlyOwnerOrOperator(domainNameHash) {
>>>>>>> MUD-188/AddressResolver
    addressOf[domainNameHash] = newAddress;

    emit AddressSet(domainNameHash, newAddress);
  }

  /**
   * @dev ERC-165 check for implementation identifier
   * @param interfaceId ID to check
   */
<<<<<<< HEAD
  function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
    return interfaceId == RESOLVER_INTERFACE_ID;
=======
  function supportsInterface(bytes4 interfaceId) external view returns (bool) {
    return interfaceId == resolverInterfaceId;
  }

  /**
   * @dev Calculate the erc165 interfaceID
   * XOR of the function selectors, which are the first 4 bytes of the keccak256 hash of the function signatures
   */
  function calculateSelector() public pure returns (bytes4) {
    bytes4 getAddressSelector = bytes4(keccak256("getAddress(bytes32)"));
    bytes4 setAddressSelector = bytes4(
      keccak256("setAddress(bytes32,address)")
    );

    return getAddressSelector ^ setAddressSelector;
>>>>>>> MUD-188/AddressResolver
  }
}
