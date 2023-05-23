// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC1967UpgradeUpgradeable }
from "@openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IZNSRegistry } from "./IZNSRegistry.sol";
import { AccessControlled } from "../access/AccessControlled.sol";


contract ZNSRegistry is AccessControlled, ERC1967UpgradeUpgradeable, IZNSRegistry {

    /**
     * @notice Mapping `domainHash` to `DomainRecord` struct to hold information
     * about each domain
     */
    mapping(bytes32 domainHash => DomainRecord domainRecord) private records;

    /**
     * @notice Mapping of `owner` => `operator` => `bool` to show accounts that
     * are or aren't allowed access to domains that `owner` has access to.
     */
    mapping(address owner => mapping(address operator => bool isOperator))
        private operators;

    /**
     * @notice Revert if `msg.sender` is not the owner or an operator allowed by the owner
     *
     * @param domainHash the hash of a domain's name
     */
    modifier onlyOwnerOrOperator(bytes32 domainHash) {
        require(
            isOwnerOrOperator(domainHash, msg.sender),
            "ZNSRegistry: Not authorized"
        );
        _;
    }

    modifier onlyOwner(bytes32 domainHash) {
        require(
            records[domainHash].owner == msg.sender,
            "ZNSRegistry: Not the Name Owner"
        );
        _;
    }

    modifier onlyRegistrar() {
        accessController.checkRegistrar(msg.sender);
        _;
    }

    /**
     * @notice Initialize the ZNSRegistry contract
     * @param _accessController The address of the AccessController contract
     */
    function initialize(address _accessController) public override initializer {
        _setAccessController(_accessController);
    }

    /**
     * @notice Check if a given domain exists
     * @param domainHash The hash of a domain's name
     */
    function exists(bytes32 domainHash) external view override returns (bool) {
        return _exists(domainHash);
    }

    /**
     * @notice Checks if provided address is an owner or an operator of the provided domain
     * @param domainHash The hash of a domain's name
     * @param candidate The address for which we are checking access
     */
    function isOwnerOrOperator(
        bytes32 domainHash,
        address candidate
    ) public view override returns (bool) {
        address owner = records[domainHash].owner;
        return candidate == owner || operators[owner][candidate];
    }

    /**
     * @notice Set an `operator` as `allowed` to give or remove permissions for all
     * domains owned by the owner `msg.sender`
     * @param operator The account to allow/disallow
     * @param allowed The true/false value to set
     */
    function setOwnerOperator(address operator, bool allowed) external override {
        operators[msg.sender][operator] = allowed;

        emit OperatorPermissionSet(msg.sender, operator, allowed);
    }

    /**
     * @notice Get a record for a domain
     * @param domainHash the hash of a domain's name
     */
    function getDomainRecord(
        bytes32 domainHash
    ) external view override returns (DomainRecord memory) {
        return records[domainHash];
    }

    /**
     * @notice Get the owner of the given domain
     * @param domainHash the hash of a domain's name
     */
    function getDomainOwner(
        bytes32 domainHash
    ) external view override returns (address) {
        return records[domainHash].owner;
    }

    /**
     * @notice Get the default resolver for the given domain
     * @param domainHash the hash of a domain's name
     */
    function getDomainResolver(
        bytes32 domainHash
    ) external view override returns (address) {
        return records[domainHash].resolver;
    }

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
    ) external override onlyRegistrar {
        _setDomainOwner(domainHash, owner);

        // We allow creation of partial domains with no resolver address
        if (resolver != address(0)) {
            _setDomainResolver(domainHash, resolver);
        }
    }

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
    ) external override onlyOwner(domainHash) {
        // `exists` is checked implicitly through the modifier
        _setDomainOwner(domainHash, owner);
        _setDomainResolver(domainHash, resolver);
    }

    /**
     * @notice Update a domain's owner
     * @param domainHash the hash of a domain's name
     * @param owner The account to transfer ownership to
     */
    function updateDomainOwner(
        bytes32 domainHash,
        address owner
    ) external override onlyOwner(domainHash) {
        // `exists` is checked implicitly through the modifier
        _setDomainOwner(domainHash, owner);
    }

    /**
     * @notice Update the domain's default resolver
     * @param domainHash the hash of a domain's name
     * @param resolver The new default resolver
     */
    function updateDomainResolver(
        bytes32 domainHash,
        address resolver
    ) external override onlyOwnerOrOperator(domainHash) {
        // `exists` is checked implicitly through the modifier
        _setDomainResolver(domainHash, resolver);
    }

    /**
     * @notice Delete a domain's record
     * @param domainHash The hash of the domain name
     */
    function deleteRecord(bytes32 domainHash) external override onlyRegistrar {
        delete records[domainHash];

        emit DomainRecordDeleted(domainHash);
    }

    function setAccessController(
        address accessController
    ) external override(AccessControlled, IZNSRegistry) onlyAdmin {
        _setAccessController(accessController);
    }

    /**
     * @notice Check if a domain exists. True if the owner is not `0x0`
     * @param domainHash the hash of a domain's name
     */
    function _exists(bytes32 domainHash) internal view returns (bool) {
        return records[domainHash].owner != address(0);
    }

    /**
     * @notice Set a domain's owner
     * Note that we don't check for `address(0)` here. This is intentional
     * because we are not currently allowing reselling of domains and want
     * to enable burning them instead by transferring ownership to `address(0)`
     * @param domainHash the hash of a domain's name
     * @param owner The owner to set
     */
    function _setDomainOwner(bytes32 domainHash, address owner) internal {
        require(owner != address(0), "ZNSRegistry: Owner cannot be zero address");
        records[domainHash].owner = owner;
        emit DomainOwnerSet(domainHash, owner);
    }

    /**
     * @notice Set a domain's resolver
     * @param domainHash the hash of a domain's name
     * @param resolver The resolver to set
     */
    function _setDomainResolver(
        bytes32 domainHash,
        address resolver
    ) internal {
        records[domainHash].resolver = resolver;
        emit DomainResolverSet(domainHash, resolver);
    }
}
