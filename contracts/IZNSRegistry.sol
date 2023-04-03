// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IZNSRegistry {
  /**
   * @dev The `DomainRecord` struct is meant to hold relevant information
   * about a domain, such as its owner and resolver.
   */
  struct DomainRecord {
    address owner;
    address resolver;
  }
  /**
   * @dev Emit when ownership of a domain is modified
   * @param owner The new domain owner
   * @param domainNameHash The identifying hash of a domain's name
   */
  event DomainOwnerSet(address indexed owner, bytes32 domainNameHash);

  /**
   * @dev Emit when a domain's resolver is modified
   * @param resolver The new resolver
   * @param domainNameHash The identifying hash of a domain's name
   */
  event DomainResolverSet(address indexed resolver, bytes32 domainNameHash);

  /**
   * @dev Emit when a domain's record is created
   * @param owner The owner of the domain
   * @param resolver The resolver for the domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  event DomainRecordCreated(
    address indexed owner,
    address indexed resolver,
    bytes32 domainNameHash
  );

  /**
   * @dev Emit when a domain's record is set and all properties are modified
   * @param owner The owner of the domain
   * @param resolver The resolver for the domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  event DomainRecordSet(
    address indexed owner,
    address indexed resolver,
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
   * @dev Checks if provided address is an owner or an operator of the provided domain
   * @param domainNameHash The identifying hash of a domain's name
   * @param candidate The address for which we are checking access
   */
  function isOwnerOrOperator(bytes32 domainNameHash, address candidate) public view returns (bool);

  /**
   * @dev Set an `operator` as `allowed` to give or remove permissions for all
   * domains owned by `msg.sender`
   *
   * @param operator The account to allow/disallow
   * @param allowed The true/false value to set
   */
  function setOwnerOperator(address operator, bool allowed) external;

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
   * @dev Get a record for a domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainRecord(
    bytes32 domainNameHash
  ) external view returns (DomainRecord memory);

  /**
   * @dev Set all properties for a domain's record
   * @param domainNameHash The identifying hash of a domain's name
   * @param owner The owner to set
   * @param resolver The resolver to set
   */
  function setDomainRecord(
    bytes32 domainNameHash,
    address owner,
    address resolver
  ) external;

  /**
   * @dev Set or create a subdomain record
   * @param domainNameHash The base domain hash
   * @param label The label to for the subdomain
   * @param owner The owner to set
   * @param resolver The resolver to set
   */
  function setSubdomainRecord(
    bytes32 domainNameHash,
    bytes32 label,
    address owner,
    address resolver
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
   * @dev Update the subdomain's owner
   * @param domainNameHash The base domain name hash
   * @param label The label of the subdomain
   * @param owner The owner to set
   */
  function setSubdomainOwner(
    bytes32 domainNameHash,
    bytes32 label,
    address owner
  ) external returns (bytes32);

  /**
   * @dev Get the default resolver for the given domain
   * @param domainNameHash The identifying hash of a domain's name
   */
  function getDomainResolver(
    bytes32 domainNameHash
  ) external view returns (address);

  /**
   * Update the domain's default resolver
   * @param domainNameHash The identifying hash of a domain's name
   * @param resolver The new default resolver
   */
  function setDomainResolver(bytes32 domainNameHash, address resolver) external;
}
