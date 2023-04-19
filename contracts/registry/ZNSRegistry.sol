// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC1967UpgradeUpgradeable }
from "@openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IZNSRegistry } from "./IZNSRegistry.sol";

contract ZNSRegistry is IZNSRegistry, ERC1967UpgradeUpgradeable {
  /**
   * @dev Mapping `domainNameHash` to `DomainRecord` struct to hold information
   * about each domain
   */
  mapping(bytes32 domainHash => DomainRecord domainRecord) private records;

  /**
   * @dev Mapping of `owner` => `operator` => `bool` to show accounts that
   * are or aren't allowed access to domains that `owner` has access to.
   */
  mapping(address owner => mapping(address operator => bool)) private operators;

  /**
   * @dev Revert if `msg.sender` is not the owner or an operator allowed by the owner
   * @param domainNameHash The identifying hash of a domain's name
   */
  modifier onlyOwnerOrOperator(bytes32 domainNameHash) {
    address owner = records[domainNameHash].owner;
    require(
      msg.sender == owner || isAllowedOperator(owner, msg.sender),
      "ZNS: Not allowed"
    );
    _;
  }

  /**
   * Initialize the ZNSRegistry contract, setting the owner of the `0x0` domain
   * to be the account that deploys this contract
   */
  function initialize(address owner) public override initializer {
    records[0x0].owner = owner;
  }

  /**
   * @dev Check if a given domain exists
   * @param domainNameHash The identifying hash of a domain's name
   */
  function exists(bytes32 domainNameHash) external view override returns (bool) {
    return _exists(domainNameHash);
  }

  /**
   * @dev Set an `operator` as `allowed` to give or remove permissions for all
   * domains owned by the owner `msg.sender`
   *
   * @param operator The account to allow/disallow
   * @param allowed The true/false value to set
   */
  function setOwnerOperator(address operator, bool allowed) external override {
    operators[msg.sender][operator] = allowed;

    emit OperatorPermissionSet(msg.sender, operator, allowed);
  }

  /**
   * @dev Verify if an account is an allowed operator on domains owned by `owner`
   * @param owner Owner of the domains to be operated on
   * @param operator Operator of modifications to the domains, if allowed
   */
  function isAllowedOperator(
    address owner,
    address operator
  ) public view override returns (bool) {
    return operators[owner][operator];
  }

  /**
   * @dev Get a record for a domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainRecord(
    bytes32 domainNameHash
  ) external view override returns (DomainRecord memory) {
    return records[domainNameHash];
  }

  /**
   * @dev Set or create a domain record
   *
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The owner to set
   * @param resolver The resolver to set
   */
  function setDomainRecord(
    bytes32 domainNameHash,
    address owner,
    address resolver
  ) external override {
    setDomainOwner(domainNameHash, owner);
    _setDomainResolver(domainNameHash, resolver);

    emit DomainRecordSet(owner, resolver, domainNameHash);
  }

  /**
   * @dev Set or create a subdomain record
   * @param parentNameHash The parent domain name hash
   * @param label The label label of the subdomain
   * @param owner The owner to set
   * @param resolver The resolver to set
   */
  function setSubdomainRecord(
    bytes32 parentNameHash,
    bytes32 label,
    address owner,
    address resolver
  ) external override {
    bytes32 subdomain = setSubdomainOwner(parentNameHash, label, owner);
    setDomainResolver(subdomain, resolver);
  }

  /**
   * @dev Update the subdomain's owner
   * @param parentNameHash The parent domain name hash
   * @param label The label of the subdomain
   * @param owner The owner to set
   */
  function setSubdomainOwner(
    bytes32 parentNameHash,
    bytes32 label,
    address owner
  ) public override onlyOwnerOrOperator(parentNameHash) returns (bytes32) {
    bytes32 subdomain = keccak256(abi.encodePacked(parentNameHash, label));
    _setDomainOwner(subdomain, owner);

    emit DomainOwnerSet(owner, subdomain);
    return subdomain;
  }

  /**
   * @dev Get the owner of the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainOwner(
    bytes32 domainNameHash
  ) external view override returns (address) {
    return records[domainNameHash].owner;
  }

  /**
   * @dev Update a domain's owner
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The account to transfer ownership to
   */
  function setDomainOwner(
    bytes32 domainNameHash,
    address owner
  ) public override onlyOwnerOrOperator(domainNameHash) {
    _setDomainOwner(domainNameHash, owner);

    emit DomainOwnerSet(owner, domainNameHash);
  }

  /**
   * @dev Get the default resolver for the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainResolver(
    bytes32 domainNameHash
  ) external view override returns (address) {
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
  ) public override onlyOwnerOrOperator(domainNameHash) {
    _setDomainResolver(domainNameHash, resolver);

    emit DomainResolverSet(resolver, domainNameHash);
  }

  /**
   * @dev Check if a domain exists. True if the owner is not `0x0`
   * @param domainNameHash The identifying hash of a domain's name
   */
  function _exists(bytes32 domainNameHash) internal view returns (bool) {
    return records[domainNameHash].owner != address(0);
  }

  /**
   * @dev Set a domain's owner
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
   * @dev Set a domain's resolver
   * @param domainNameHash The identifying hash of a domain's name
   * @param resolver The resolver to set
   */
  function _setDomainResolver(
    bytes32 domainNameHash,
    address resolver
  ) internal {
    require(resolver != address(0), "ZNS: Resolver can NOT be zero address");

    records[domainNameHash].resolver = resolver;
  }
}
