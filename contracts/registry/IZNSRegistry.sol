// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IZNSRegistry {

    /**
     * @notice The `DomainRecord` struct is meant to hold relevant information
     * about a domain, such as its owner and resolver.
     */
    struct DomainRecord {
        address owner;
        address resolver;
    }

    /**
     * @notice Emit when ownership of a domain is modified
     * @param owner The new domain owner
     * @param domainHash the hash of a domain's name
     */
    event DomainOwnerSet(
        bytes32 indexed domainHash,
        address indexed owner
    );

    /**
     * @notice Emit when a domain's resolver is modified
     * @param resolver The new resolver
     * @param domainHash the hash of a domain's name
     */
    event DomainResolverSet(
        bytes32 indexed domainHash,
        address indexed resolver
    );

    /**
     * @notice Emit when a record is deleted
     * @param domainHash The hash of a domain's name
     */
    event DomainRecordDeleted(
        bytes32 indexed domainHash
    );

    /**
     * @notice Emit when an owner allows/disallows permissions for an operator
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
     * @notice Initialize the ZNSRegistry contract
     * @param _accessController The address of the AccessController contract
     */
    function initialize(address _accessController) external;

    /**
     * @notice Check if a given domain exists
     * @param domainHash The hash of a domain's name
     */
    function exists(bytes32 domainHash) external view returns (bool);

    /**
     * @notice Checks if provided address is an owner or an operator of the provided domain
     * @param domainHash The hash of a domain's name
     * @param candidate The address for which we are checking access
     */
    function isOwnerOrOperator(
        bytes32 domainHash,
        address candidate
    ) external view returns (bool);

    /**
     * @notice Set an `operator` as `allowed` to give or remove permissions for all
     * domains owned by `msg.sender`
     * @param operator The account to allow/disallow
     * @param allowed The true/false value to set
     */
    function setOwnerOperator(address operator, bool allowed) external;

    /**
     * @notice Get a record for a domain
     * @param domainHash the hash of a domain's name
     */
    function getDomainRecord(
        bytes32 domainHash
    ) external view returns (DomainRecord memory);

    /**
     * @notice Get the owner of the given domain
     * @param domainHash the hash of a domain's name
     */
    function getDomainOwner(
        bytes32 domainHash
    ) external view returns (address);

    /**
     * @notice Get the default resolver for the given domain
     * @param domainHash The hash of a domain's name
     */
    function getDomainResolver(
        bytes32 domainHash
    ) external view returns (address);

    /**
     * @notice Create a new domain record
     * @param domainHash The hash of the domain name
     * @param owner The owner of the new domain
     * @param resolver The resolver of the new domain
     */
    function createDomainRecord(
        bytes32 domainHash,
        address owner,
        address resolver
    ) external;

    /**
     * @notice Update an existing domain record's owner or resolver
     * @param domainHash The hash of the domain
     * @param owner The owner or an allowed operator of that domain
     * @param resolver The resolver for the domain
     */
    function updateDomainRecord(
        bytes32 domainHash,
        address owner,
        address resolver
    ) external;

    /**
     * @notice Update a domain's owner
     * @param domainHash the hash of a domain's name
     * @param owner The account to transfer ownership to
     */
    function updateDomainOwner(bytes32 domainHash, address owner) external;

    /**
     * @notice Update the domain's default resolver
     * @param domainHash the hash of a domain's name
     * @param resolver The new default resolver
     */
    function updateDomainResolver(
        bytes32 domainHash,
        address resolver
    ) external;

    /**
     * @notice Delete a domain's record
     * @param domainHash The hash of the domain name
     */
    function deleteRecord(bytes32 domainHash) external;

    /**
     * @notice Set the access controller contract
     * @param accessController The new access controller
     */
    function setAccessController(address accessController) external;

    function getAccessController() external view returns (address);
}
