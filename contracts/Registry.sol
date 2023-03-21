// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC1967UpgradeUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol";
import {IResolver} from "./IResolver.sol";
import {IRegistry} from "./IRegistry.sol";

contract Registry is IRegistry, ERC1967UpgradeUpgradeable {
  /**
   * @dev Mapping `domainNameHash` to `DomainRecord` struct to hold information
   * about each domain
   */
  mapping(bytes32 => DomainRecord) records;

  /**
   * @dev Mapping of `owner` => `operator` => `bool` to show accounts that
   * are or aren't allowed access to domains that `owner` has access to.
   */
  mapping(address => mapping(address => bool)) operators;

  /**
   * @dev Check if a given domain exists
   * @param domainNameHash The identifying hash of a domain's name
   */
  function exists(bytes32 domainNameHash) external view returns (bool) {
    return _exists(domainNameHash);
  }

  /**
   * @dev Set an `operator` as `allowed` to give or remove permissions for all
   * domains owned by `msg.sender`
   *
   * @param operator The account to allow/disallow
   * @param allowed The true/false value to set
   */
  function setDomainOperator(address operator, bool allowed) external {
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
  ) public view returns (bool) {
    return operators[owner][operator];
  }

  /**
   * @dev Set all properties for a domain's record
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The owner to set
   * @param resolver The resolver to set
   */
  function setDomainRecord(
    bytes32 domainNameHash,
    address owner,
    IResolver resolver
  ) public {
    _checkSetDomainProperty(domainNameHash);
    _setDomainOwner(domainNameHash, owner);
    _setDomainResolver(domainNameHash, resolver);

    emit DomainRecordSet(owner, resolver, domainNameHash);
  }

  /**
   * @dev Get the owner of the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainOwner(
    bytes32 domainNameHash
  ) public view returns (address) {
    return records[domainNameHash].owner;
  }

  /**
   * @dev Update the domain's owner
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The account to transfer ownership to
   */
  function setDomainOwner(bytes32 domainNameHash, address owner) public {
    _checkSetDomainProperty(domainNameHash);
    _setDomainOwner(domainNameHash, owner);

    emit DomainOwnerSet(owner, domainNameHash);
  }

  /**
   * @dev Get the default resolver for the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainResolver(
    bytes32 domainNameHash
  ) public view returns (IResolver) {
    require(bytes32(domainNameHash).length != 0, "ZNS: No domain");

    return records[domainNameHash].defaultResolver;
  }

  /**
   * Update the domain's default resolver
   * @param domainNameHash The identifying hash of a domain's name
   * @param resolver The new default resolver
   */
  function setDomainResolver(
    bytes32 domainNameHash,
    IResolver resolver
  ) public {
    _checkSetDomainProperty(domainNameHash);
    _setDomainResolver(domainNameHash, resolver);
  }

  /**
   * @dev Get the hash for a given domain name
   * @param domainName The name of the domain
   */
  function getDomainNameHash(
    string memory domainName
  ) external pure returns (bytes32) {
    require(bytes(domainName).length != 0, "ZNS: No domain");
    return keccak256(abi.encodePacked("znsdomain", domainName));
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
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The owner to set
   */
  function _setDomainOwner(bytes32 domainNameHash, address owner) internal {
    require(owner != address(0), "ZNS: Zero address");
    records[domainNameHash].owner = owner;
  }

  /**
   * @dev Set a domain's resolver
   * @param domainNameHash The identifying hash of a domain's name
   * @param resolver The resolver to set
   */
  function _setDomainResolver(
    bytes32 domainNameHash,
    IResolver resolver
  ) internal {
    require(address(resolver) != address(0), "ZNS: Zero address");
    records[domainNameHash].defaultResolver = resolver;
  }

  /**
   * @dev Checks to ensure that setting a property of a domain is both allowed and valid
   * @param domainNameHash The identifying hash of a domain's name
   */
  function _checkSetDomainProperty(bytes32 domainNameHash) internal view {
    _onlyDomainOwnerOrOperator(domainNameHash);
    _isValidDomain(domainNameHash);
  }

  /**
   * @dev Revert if the domain does not exist or the hash given is empty
   * @param domainNameHash The identifying hash of the domain's name
   */
  function _isValidDomain(bytes32 domainNameHash) internal view {
    require(domainNameHash.length != 0, "ZNS: No domain given");
    require(_exists(domainNameHash), "ZNS: Not a domain");
  }

  /**
   * @dev Revert if `msg.sender` is not the owner or an operator allowed by the owner
   * @param domainNameHash The identifying hash of a domain's name
   */
  function _onlyDomainOwnerOrOperator(bytes32 domainNameHash) internal view {
    address owner = records[domainNameHash].owner;
    require(
      msg.sender == owner || operators[owner][msg.sender],
      "ZNS: Not allowed"
    );
  }
}
