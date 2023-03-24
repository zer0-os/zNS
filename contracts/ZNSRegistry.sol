// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC1967UpgradeUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol";
import {IZNSRegistry} from "./IZNSRegistry.sol";

contract ZNSRegistry is IZNSRegistry, ERC1967UpgradeUpgradeable {
  /**
   * @dev Constant string used in the hashing of domain names
   */
  // DELETE???
  string public constant HASH_MARK = "ZNSDOMAIN";

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
   * @dev Revert if `msg.sender` is not the owner or an operator allowed by the owner
   * @param domainNameHash The identifying hash of a domain's name
   */
  modifier onlyOwnerOrOperator(bytes32 domainNameHash) {
    address owner = records[domainNameHash].owner;
    require(
      msg.sender == owner || operators[owner][msg.sender],
      "ZNS: Not allowed"
    );
    _;
  }

  /**
   * @dev Revert if the domain does not exist or the hash given is empty
   * @param domainNameHash The identifying hash of the domain's name
   */
  modifier validDomain(bytes32 domainNameHash) {
    require(
      domainNameHash.length != 0 && domainNameHash != 0x0,
      "ZNS: No domain given"
    );
    require(_exists(domainNameHash), "ZNS: No domain found");
    _;
  }

  /**
   * @dev Check if a given domain exists
   * @param domainNameHash The identifying hash of a domain's name
   */
  function exists(bytes32 domainNameHash) external view returns (bool) {
    return _exists(domainNameHash);
  }

  /**
   * @dev Set an `operator` as `allowed` to give or remove permissions for all
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
   * @dev Creates a new domain record owned by `msg.sender`
   * @param domainNameHash The identifying hash of a domain's name
   * @param resolver The resolver to set
   */
  function createDomainRecord(bytes32 domainNameHash, address resolver) public {
    require(
      domainNameHash.length != 0 && domainNameHash != 0x0,
      "ZNS: No domain given"
    );
    require(!_exists(domainNameHash), "ZNS: Domain exists");

    _setDomainOwner(domainNameHash, msg.sender);
    _setDomainResolver(domainNameHash, resolver);

    emit DomainRecordCreated(msg.sender, resolver, domainNameHash);
  }

  /**
   * @dev Get a record for a domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainRecord(
    bytes32 domainNameHash
  ) public view returns (DomainRecord memory) {
    return records[domainNameHash];
  }

  /**
   * @dev Set any or all properties for an existing domain record
   * Note must alter at least one property
   *
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The owner to set
   * @param resolver The resolver to set
   */
  function setDomainRecord(
    bytes32 domainNameHash,
    address owner,
    address resolver
  ) public validDomain(domainNameHash) onlyOwnerOrOperator(domainNameHash) {
    require(
      records[domainNameHash].owner != owner ||
        records[domainNameHash].resolver != resolver,
      "ZNS: No record change"
    );

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
   * @dev Update a domain's owner
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The account to transfer ownership to
   */
  function setDomainOwner(
    bytes32 domainNameHash,
    address owner
  ) public validDomain(domainNameHash) onlyOwnerOrOperator(domainNameHash) {
    address currentOwner = records[domainNameHash].owner;
    require(currentOwner != owner, "ZNS: Same owner");
    _setDomainOwner(domainNameHash, owner);

    emit DomainOwnerSet(owner, domainNameHash);
  }

  /**
   * @dev Get the default resolver for the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainResolver(
    bytes32 domainNameHash
  ) public view returns (address) {
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
  ) public validDomain(domainNameHash) onlyOwnerOrOperator(domainNameHash) {
    address currentResolver = records[domainNameHash].resolver;
    require(currentResolver != resolver, "ZNS: Same resolver");
    _setDomainResolver(domainNameHash, resolver);

    emit DomainResolverSet(resolver, domainNameHash);
  }

  /**
   * @dev Get the hash for a given domain name
   * @param domainName The name of the domain
   */
  function getDomainNameHash(
    string memory domainName
  ) external pure returns (bytes32) {
    // TODO This function may be better suited in the Registrar contract
    require(bytes(domainName).length != 0, "ZNS: No domain");
    return keccak256(abi.encodePacked(HASH_MARK, domainName));
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
    require(resolver != address(0), "ZNS: Zero address");

    records[domainNameHash].resolver = resolver;
  }
}
