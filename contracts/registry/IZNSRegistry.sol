// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;


/**
 * @notice The `DomainRecord` struct is meant to hold relevant information
 * about a domain, such as its owner and resolver.
 * - `owner` (address): The owner of the domain (also called the owner of the Name).
 * - `resolver` (address): The address of the Resolver contract where this domain's source records are stored.
 *
 * In the future, there will be multiple Resolver contracts that support different types of sources.
 * Currently, only the `ZNSAddressResolver` is implemented.
 */
interface IZNSRegistry {

    /**
     * @notice Description of a domain record, pointing to the 
     * owner address of that record as well as the address of
     * its resolver
     */
    struct DomainRecord {
        address owner;
        address resolver;
    }

    /**
     * @notice Emits when ownership of a domain is modified in ``records``
     * @param domainHash the hash of a domain's name
     * @param owner The new domain owner
     */
    event DomainOwnerSet(
        bytes32 indexed domainHash,
        address indexed owner
    );

    /**
     * @notice Emit when a domain's resolver is modified in ``records``
     * @param domainHash the hash of a domain's name
     * @param resolver The new resolver address
     */
    event DomainResolverSet(
        bytes32 indexed domainHash,
        address indexed resolver
    );

    /**
     * @notice Emits when a domain record is deleted
     * @param domainHash The hash of a domain's name
     */
    event DomainRecordDeleted(
        bytes32 indexed domainHash
    );

    /**
     * @notice Emit when an owner allows/disallows permissions for an operator
     * @param owner Owner of the domain in question
     * @param operator Address that was allowed/disallowed
     * @param allowed Boolean status of their permission
     */
    event OperatorPermissionSet(
        address indexed owner,
        address indexed operator,
        bool allowed
    );

    function initialize(address accessController) external;

    function exists(bytes32 domainHash) external view returns (bool);

    function isOwnerOrOperator(
        bytes32 domainHash,
        address candidate
    ) external view returns (bool);

    function setOwnerOperator(address operator, bool allowed) external;

    function getDomainRecord(
        bytes32 domainHash
    ) external view returns (DomainRecord memory);

    function getDomainOwner(
        bytes32 domainHash
    ) external view returns (address);

    function getDomainResolver(
        bytes32 domainHash
    ) external view returns (address);

    function createDomainRecord(
        bytes32 domainHash,
        address owner,
        address resolver
    ) external;

    function updateDomainRecord(
        bytes32 domainHash,
        address owner,
        address resolver
    ) external;

    function updateDomainOwner(bytes32 domainHash, address owner) external;

    function updateDomainResolver(
        bytes32 domainHash,
        address resolver
    ) external;

    function deleteRecord(bytes32 domainHash) external;
}
