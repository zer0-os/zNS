// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC1967UpgradeUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IZNSRegistry} from "./IZNSRegistry.sol";

contract ZNSRegistry is IZNSRegistry, ERC1967UpgradeUpgradeable {
  /**
   * @notice Constant to represent the root domain hash
   */
  bytes32 public constant ROOT_HASH = keccak256(bytes("0://"));

  /**
   * @notice Mapping `domainNameHash` to `DomainRecord` struct to hold information
   * about each domain
   */
  mapping(bytes32 domainHash => DomainRecord domainRecord) private records;

  /**
   * @notice Mapping of `owner` => `operator` => `bool` to show accounts that
   * are or aren't allowed access to domains that `owner` has access to.
   */
  mapping(address owner => mapping(address operator => bool)) private operators;

  /**
   * @notice Revert if `msg.sender` is not the owner or an operator allowed by the owner
   * @param domainNameHash The identifying hash of a domain's name
   */
  modifier onlyOwnerOrOperator(bytes32 domainNameHash) {
    require(isOwnerOrOperator(domainNameHash, msg.sender), "ZNSRegistry: Not allowed");
    _;
  }

  /**
   * Initialize the ZNSRegistry contract, setting the owner of the `0x0` domain
   * to be the account that deploys this contract
   */
  function initialize(address owner) public initializer {
    require(owner != address(0), "ZNSRegistry: No zero owner allowed");
    records[ROOT_HASH].owner = owner;
    // TODO use the hash constant here ?
    // Does it benefit us? is it problematic ?
    // can people manipulate or own it?
  }

  /**
   * @notice Check if a given domain exists
   * @param domainNameHash The identifying hash of a domain's name
   */
  function exists(bytes32 domainNameHash) external view returns (bool) {
    return _exists(domainNameHash);
  }

  /**
   * @notice Checks if provided address is an owner or an operator of the provided domain
   * @param domainNameHash The identifying hash of a domain's name
   * @param candidate The address for which we are checking access
   */
  function isOwnerOrOperator(
    bytes32 domainNameHash,
    address candidate
  ) public view returns (bool) {
    address owner = records[domainNameHash].owner;
    return candidate == owner || operators[owner][candidate];
  }

  /**
   * @notice Set an `operator` as `allowed` to give or remove permissions for all
   * domains owned by the owner `msg.sender`
   *
   * @param operator The account to allow/disallow
   * @param allowed The true/false value to set
   */
  function setOwnerOperator(address operator, bool allowed) external {
    operators[msg.sender][operator] = allowed;

    emit OperatorPermissionSet(msg.sender, operator, allowed);
  }

  /**
   * @notice Verify if an account is an allowed operator on domains owned by `owner`
   * @param owner Owner of the domains to be operated on
   * @param operator Operator of modifications to the domains, if allowed
   */
  function isAllowedOperator(
    address owner,
    address operator
  ) public view returns (bool) {
    return operators[owner][operator];
  }

  /**
   * @notice Get a record for a domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainRecord(
    bytes32 domainNameHash
  ) external view returns (DomainRecord memory) {
    return records[domainNameHash];
  }

  // TODO add access control. do we need to revoke operator as well?
  function deleteRecord(bytes32 domainNameHash) external {
    // this could call to an internal func _deleteDomainRecord
    // Then when `setDomainRecord` is `0x0` values, we can also delete there
    require(msg.sender == records[domainNameHash].owner, "ZNSRegistry");
    delete records[domainNameHash];
  }

  /**
   * @notice Set or create a subdomain record
   * @param parentDomainHash The parent domain name hash
   * @param domainHash The label of the subdomain
   * @param owner The owner to set
   * @param resolver The resolver to set
   */
  function setSubdomainRecord(
    bytes32 parentDomainHash,
    bytes32 domainHash,
    address owner,
    address resolver
  ) external returns (bytes32) {
    setSubdomainOwner(parentDomainHash, domainHash, owner);
    setDomainResolver(domainHash, resolver);

    return domainHash;
  }

  /**
   * @notice Update the domain's owner
   * @param parentDomainHash The base domain name hash
   * @param domainHash The label of the subdomain
   * @param owner The owner to set
   */
  function setSubdomainOwner(
    bytes32 parentDomainHash,
    bytes32 domainHash,
    address owner
  ) public onlyOwnerOrOperator(parentDomainHash) {
    _setDomainOwner(domainHash, owner);

    emit DomainOwnerSet(owner, domainHash);
  }

  /**
   * @notice Get the owner of the given domain
   * @param domainHash The identifying hash of a domain's name
   */
  function getDomainOwner(
    bytes32 domainHash
  ) external view returns (address) {
    return records[domainHash].owner;
  }

  /**
   * @notice Update a domain's owner
   * @param domainHash The identifying hash of a domain's name
   * @param owner The account to transfer ownership to
   */
  // function setDomainOwner(
  //   bytes32 domainHash,
  //   address owner
  // ) public onlyOwnerOrOperator(domainHash) {
  //   _setDomainOwner(domainHash, owner);

  //   // TODO probably don't need any "domain" functions
  //   // emit DomainOwnerSet(owner, domainNameHash);
  // }

  /**
   * @notice Get the default resolver for the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainResolver(
    bytes32 domainNameHash
  ) external view returns (address) {
    return records[domainNameHash].resolver;
  }

  /**
   * Update the domain's default resolver
   * @param domainNameHash The identifying hash of a domain's name
   * @param resolver The new default resolver
   */
  function setDomainResolver(
    bytes32 domainNameHash,
    address resolver
  ) public onlyOwnerOrOperator(domainNameHash) {
    _setDomainResolver(domainNameHash, resolver);

    emit DomainResolverSet(resolver, domainNameHash);
  }

  /**
   * @notice Check if a domain exists. True if the owner is not `0x0`
   * @param domainNameHash The identifying hash of a domain's name
   */
  function _exists(bytes32 domainNameHash) internal view returns (bool) {
    return records[domainNameHash].owner != address(0);
  }

  /**
   * @notice Set a domain's owner
   * Note that we don't check for `address(0)` here. This is intentional
   * because we are not currently allowing reselling of domains and want
   * to enable burning them instead by transferring ownership to `address(0)`
   *
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The owner to set
   */
  function _setDomainOwner(bytes32 domainNameHash, address owner) internal {
    require(owner != address(0), "ZNS: Owner can NOT be zero address");
    records[domainNameHash].owner = owner;
  }

  /**
   * @notice Set a domain's resolver
   * @param domainNameHash The identifying hash of a domain's name
   * @param resolver The resolver to set
   */
  function _setDomainResolver(
    bytes32 domainNameHash,
    address resolver
  ) internal {
    require(resolver != address(0), "ZNSRegistry: Resolver cannot be the zero address");

    records[domainNameHash].resolver = resolver;
  }
}
