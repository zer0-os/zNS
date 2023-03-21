// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IResolver} from "./IResolver.sol";

interface IRegistry {
  /**
   * @dev The `DomainRecord` struct is meant to hold relevant information
   * about a domain, such as its owner and resolver.
   */
  struct DomainRecord {
    address owner;
    IResolver defaultResolver;
  }
  /**
   * @dev Emit when ownership of a domain is modified
   * @param to The new domain owner
   * @param domainNameHash The identifying hash of a domain's name
   */
  event DomainOwnerSet(address indexed to, bytes32 domainNameHash);

  /**
   * @dev Emit when a domain's resolver is modified
   * @param to The new resolver
   * @param domainNameHash The identifying hash of a domain's name
   */
  event DomainResolverSet(IResolver indexed to, bytes32 domainNameHash);

  /**
   * @dev Emit when a domain's record is set and all properties are modified
   * @param owner The owner of the domain
   * @param resolver The resolver for the domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  event DomainRecordSet(
    address indexed owner,
    IResolver indexed resolver,
    bytes32 domainNameHash
  );

  /**
   * @dev Emit when an owner allows/disallows permissions for an operator
   * @param owner Owner of the domain in question
   * @param operator User that was allowed/disallowed
   * @param allowed Boolean status of their permission
   */
  event OperatorPermissionSet(
    address indexed owner,
    address indexed operator,
    bool allowed
  );

  /**
   * @dev Check if a given domain exists
   * @param domainNameHash The identifying hash of a domain's name
   */
  function exists(bytes32 domainNameHash) external view returns (bool);

  /**
   * @dev Set an `operator` as `allowed` to give or remove permissions for all
   * domains owned by `msg.sender`
   *
   * @param operator The account to allow/disallow
   * @param allowed The true/false value to set
   */
  function setDomainOperator(address operator, bool allowed) external;

  /**
   * @dev Verify if an account is an allowed operator on domains owned by `owner`
   * @param owner Owner of the domains to be operated on
   * @param operator Operator of modifications to the domains, if allowed
   */
  function isAllowedOperator(
    address owner,
    address operator
  ) external view returns (bool);

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
  ) external;

  /**
   * @dev Get the owner of the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainOwner(
    bytes32 domainNameHash
  ) external view returns (address);

  /**
   * @dev Update the domain's owner
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The account to transfer ownership to
   */
  function setDomainOwner(bytes32 domainNameHash, address owner) external;

  /**
   * @dev Get the default resolver for the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainResolver(
    bytes32 domainNameHash
  ) external view returns (IResolver);

  /**
   * Update the domain's default resolver
   * @param domainNameHash The identifying hash of a domain's name
   * @param resolver The new default resolver
   */
  function setDomainResolver(
    bytes32 domainNameHash,
    IResolver resolver
  ) external;

  /**
   * @dev Get the hash for a given domain name
   * @param domainName The name of the domain
   */
  function getDomainNameHash(
    string memory domainName
  ) external pure returns (bytes32);
}
