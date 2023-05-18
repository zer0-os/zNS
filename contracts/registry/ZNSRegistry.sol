// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC1967UpgradeUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IZNSRegistry} from "./IZNSRegistry.sol";

contract ZNSRegistry is IZNSRegistry, ERC1967UpgradeUpgradeable {
    /**
     * @notice The address of the registrar we are using
     */
    address public znsRegistrar;
    /**
     * @notice Mapping `domainNameHash` to `DomainRecord` struct to hold information
     * about each domain
     */
    mapping(bytes32 domainNameHash => DomainRecord domainRecord)
        private records;

    /**
     * @notice Mapping of `owner` => `operator` => `bool` to show accounts that
     * are or aren't allowed access to domains that `owner` has access to.
     */
    mapping(address owner => mapping(address operator => bool isOperator))
        private operators;

    /**
     * @notice Revert if `msg.sender` is not the owner or an operator allowed by the owner
     *
     * @param domainNameHash the hash of a domain's name
     */
    modifier onlyOwnerOrOperator(bytes32 domainNameHash) {
        require(
            isOwnerOrOperator(domainNameHash, msg.sender),
            "ZNSRegistry: Not Authorized"
        );
        _;
    }

    /**
     * @notice Revert if `msg.sender` is not the registrar
     */
    modifier onlyRegistrar() {
        require(
            msg.sender == znsRegistrar,
            "ZNSRegistry: Caller is not the Registrar"
        );
        _;
    }

    /**
     * Initialize the ZNSRegistry contract, setting the owner of the `0x0` domain
     * to be the account that deploys this contract
     */
    function initialize(address znsRegistrar_) public initializer {
        require(
            znsRegistrar != address(0),
            "ZNSRegistry: Registrar can not be 0x0 address"
        );
        znsRegistrar = znsRegistrar_;
        // TODO use the hash constant here ?
        // Does it benefit us? is it problematic ?
        // can people manipulate or own it?
    }

    /**
     * @notice Check if a given domain exists
     *
     * @param domainNameHash The hash of a domain's name
     */
    function exists(bytes32 domainNameHash) external view returns (bool) {
        return _exists(domainNameHash);
    }

    /**
     * @notice Checks if provided address is an owner or an operator of the provided domain
     *
     * @param domainNameHash The hash of a domain's name
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
     * @notice Change the address of the ZNSRegistrar contract we use
     *
     * @param znsRegistrar_ The new ZNSRegistrar
     */
    // TODO When we have access control, only be callable by admin!!
    // function setRegistrar(address znsRegistrar_) public {
    //     require(
    //         znsRegistrar_ != address(0),
    //         "ZNSRegistry: Cannot set Registrar to 0x0"
    //     );

    //     znsRegistrar = znsRegistrar_;
    //     // TODO emit RegistrarSet() event
    // }

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
     * @notice Get a record for a domain
     *
     * @param domainNameHash the hash of a domain's name
     */
    function getDomainRecord(
        bytes32 domainNameHash
    ) external view returns (DomainRecord memory) {
        return records[domainNameHash];
    }

    /**
     * @notice Get the owner of the given domain
     *
     * @param domainNameHash the hash of a domain's name
     */
    function getDomainOwner(
        bytes32 domainNameHash
    ) external view returns (address) {
        return records[domainNameHash].owner;
    }

    /**
     * @notice Get the default resolver for the given domain
     *
     * @param domainNameHash the hash of a domain's name
     */
    function getDomainResolver(
        bytes32 domainNameHash
    ) external view returns (address) {
        return records[domainNameHash].resolver;
    }

    /**
     * @notice Create a new domain record
     *
     * @param domainNameHash The hash of the domain name
     * @param owner The owner of the new domain
     * @param resolver The resolver of the new domain
     */
    function createDomainRecord(
        bytes32 domainNameHash,
        address owner,
        address resolver
    ) external {
        _setDomainOwner(domainNameHash, owner);
        _setDomainResolver(domainNameHash, resolver);
        // TODO emit
    }

    /**
     * @notice Update an existing domain record's owner or resolver
     *
     * @param domainNameHash The hash of the domain
     * @param owner The owner or an allowed operator of that domain
     * @param resolver The resolver for the domain
     */
    function setDomainRecord(
        bytes32 domainNameHash,
        address owner,
        address resolver
    ) external onlyOwnerOrOperator(domainNameHash) {
        require(_exists(domainNameHash), "ZNSRegistry: Domain does not exist");
        _setDomainOwner(domainNameHash, owner);
        _setDomainResolver(domainNameHash, resolver);

        // TODO emit
    }

    // TODO: review and remove all non-essential function when working
    //  on the deletion of subdomains and/or reworking the Registry API
    /**
     * @notice Update a domain's owner
     *
     * @param domainNameHash the hash of a domain's name
     * @param owner The account to transfer ownership to
     */
    function setDomainOwner(
        bytes32 domainNameHash,
        address owner
    ) external onlyOwnerOrOperator(domainNameHash) {
        require(_exists(domainNameHash), "ZNSRegistry: Domain does not exist");
        _setDomainOwner(domainNameHash, owner);

        // TODO probably don't need any "domain" functions
        // emit DomainOwnerSet(owner, domainNameHash);
    }

    /**
     * @notice Update the domain's default resolver
     *
     * @param domainNameHash the hash of a domain's name
     * @param resolver The new default resolver
     */
    function setDomainResolver(
        bytes32 domainNameHash,
        address resolver
    ) external onlyOwnerOrOperator(domainNameHash) {
        require(_exists(domainNameHash), "ZNSRegistry: Domain does not exist");
        _setDomainResolver(domainNameHash, resolver);

        emit DomainResolverSet(resolver, domainNameHash);
    }

    /**
     * @notice Delete a domain's record
     *
     * @param domainNameHash The hash of the domain name
     */
    function deleteRecord(bytes32 domainNameHash) external onlyRegistrar {
        // TODO Test if after revocation an operator can do anything to verify
        // we don't need to clear them.
        delete records[domainNameHash];
    }

    /**
     * @notice Check if a domain exists. True if the owner is not `0x0`
     *
     * @param domainNameHash the hash of a domain's name
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
     * @param domainNameHash the hash of a domain's name
     * @param owner The owner to set
     */
    function _setDomainOwner(bytes32 domainNameHash, address owner) internal {
        require(owner != address(0), "ZNS: Owner can NOT be zero address");
        records[domainNameHash].owner = owner;
    }

    /**
     * @notice Set a domain's resolver
     *
     * @param domainNameHash the hash of a domain's name
     * @param resolver The resolver to set
     */
    function _setDomainResolver(
        bytes32 domainNameHash,
        address resolver
    ) internal {
        // TODO Allow setting resolver to 0?
        // If owner is 0, it is a burned domain
        // If resolver is zero, nothing happens
        require(
            resolver != address(0),
            "ZNSRegistry: Resolver cannot be zero address"
        );

        records[domainNameHash].resolver = resolver;
    }
}
