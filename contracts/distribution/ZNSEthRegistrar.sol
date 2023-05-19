// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSEthRegistrar } from "./IZNSEthRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSAddressResolver } from "../resolver/IZNSAddressResolver.sol";
import { AccessControlled } from "../access/AccessControlled.sol";

contract ZNSEthRegistrar is AccessControlled, IZNSEthRegistrar {

    IZNSRegistry public znsRegistry;
    IZNSTreasury public znsTreasury;
    IZNSDomainToken public znsDomainToken;
    IZNSAddressResolver public znsAddressResolver;


    modifier onlyNameOwner(bytes32 domainHash) {
        require(
            msg.sender == znsRegistry.getDomainOwner(domainHash),
            "ZNSEthRegistrar: Not the Owner of the Name"
        );
        _;
    }

    modifier onlyTokenOwner(bytes32 domainHash) {
        require(
            msg.sender == znsDomainToken.ownerOf(uint256(domainHash)),
            "ZNSEthRegistrar: Not the owner of the Token"
        );
        _;
    }

    /**
     * @notice Create an instance of the ZNSEthRegistrar
     * for registering ZNS domains and subdomains
     */
    constructor(
        address accessController_,
        address znsRegistry_,
        address znsTreasury_,
        address znsDomainToken_,
        address znsAddressResolver_
    ) {
        _setAccessController(accessController_);
        // TODO AC: should we call protected functions in the constructor/initialize?
        setZnsRegistry(znsRegistry_);
        setZnsTreasury(znsTreasury_);
        setZnsDomainToken(znsDomainToken_);
        setZnsAddressResolver(znsAddressResolver_);
    }

    /**
     * @notice Register a new domain such as `0://wilder`
     *
     * @param name Name of the domain to register
     * @param resolverContent Address for the resolver to return when requested (optional, send 0x0 if not needed)
     */
    function registerDomain(
        string calldata name,
        address resolverContent
    ) external override returns (bytes32) {
        require(
            bytes(name).length != 0,
            "ZNSEthRegistrar: Domain Name not provided"
        );

        // Create hash for given domain name
        bytes32 domainHash = keccak256(bytes(name));

        require(
            !znsRegistry.exists(domainHash),
            "ZNSEthRegistrar: Domain already exists"
        );

        // Staking logic
        znsTreasury.stakeForDomain(domainHash, name, msg.sender, true);

        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);
        znsDomainToken.register(msg.sender, tokenId);

        _setDomainData(domainHash, msg.sender, resolverContent);

        emit DomainRegistered(
            domainHash,
            tokenId,
            name,
            msg.sender,
            address(znsAddressResolver)
        );

        return domainHash;
    }

    function revokeDomain(bytes32 domainHash)
    external
    override
    // TODO: figure out how to guard this so people can stake tokens
    //  without the risk of staking contract or wallet to call reclaim+revoke
    //  from underneath them
    onlyNameOwner(domainHash)
    onlyTokenOwner(domainHash)
    {
        uint256 tokenId = uint256(domainHash);
        znsDomainToken.revoke(tokenId);
        znsTreasury.unstakeForDomain(domainHash, msg.sender);
        znsRegistry.deleteRecord(domainHash);

        emit DomainRevoked(domainHash, msg.sender);
    }

    function reclaimDomain(bytes32 domainHash)
    external
    override
    onlyTokenOwner(domainHash)
    {
        znsRegistry.updateDomainOwner(domainHash, msg.sender);

        emit DomainReclaimed(domainHash, msg.sender);
    }

    function setZnsRegistry(address znsRegistry_) public override onlyRole(ADMIN_ROLE) {
        require(
            znsRegistry_ != address(0),
            "ZNSEthRegistrar: znsRegistry_ is 0x0 address"
        );
        znsRegistry = IZNSRegistry(znsRegistry_);

        emit ZnsRegistrySet(znsRegistry_);
    }

    function setZnsTreasury(address znsTreasury_) public override onlyRole(ADMIN_ROLE) {
        require(
            znsTreasury_ != address(0),
            "ZNSEthRegistrar: znsTreasury_ is 0x0 address"
        );
        znsTreasury = IZNSTreasury(znsTreasury_);

        emit ZnsTreasurySet(znsTreasury_);
    }

    function setZnsDomainToken(address znsDomainToken_) public override onlyRole(ADMIN_ROLE) {
        require(
            znsDomainToken_ != address(0),
            "ZNSEthRegistrar: znsDomainToken_ is 0x0 address"
        );
        znsDomainToken = IZNSDomainToken(znsDomainToken_);

        emit ZnsDomainTokenSet(znsDomainToken_);
    }

    function setZnsAddressResolver(address znsAddressResolver_) public override onlyRole(ADMIN_ROLE) {
        require(
            znsAddressResolver_ != address(0),
            "ZNSEthRegistrar: znsAddressResolver_ is 0x0 address"
        );
        znsAddressResolver = IZNSAddressResolver(znsAddressResolver_);

        emit ZnsAddressResolverSet(znsAddressResolver_);
    }

    function setAccessController(address accessController_)
    external
    override(AccessControlled, IZNSEthRegistrar)
    onlyRole(ADMIN_ROLE)
    {
        _setAccessController(accessController_);
    }

    /**
     * @notice Set domain data appropriately for a newly registered domain
     *
     * @param domainHash The domain name hash
     * @param owner The owner of that domain
     * @param resolverContent The content it resolves to
     */
    function _setDomainData(
        bytes32 domainHash,
        address owner,
        address resolverContent
    ) internal {
        // Set only the domain owner if no resolver content is given
        if (resolverContent != address(0)) {
            znsRegistry.createDomainRecord(domainHash, owner, address(znsAddressResolver));
            znsAddressResolver.setAddress(domainHash, resolverContent);
        } else {
            znsRegistry.createDomainRecord(domainHash, owner, address(0));
        }
    }
}
