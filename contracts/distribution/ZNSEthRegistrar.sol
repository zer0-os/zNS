// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSEthRegistrar } from "./IZNSEthRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSAddressResolver } from "../resolver/IZNSAddressResolver.sol";
import { AccessControlled } from "../access/AccessControlled.sol";


contract ZNSEthRegistrar is AccessControlled, IZNSEthRegistrar {

    IZNSRegistry public registry;
    IZNSTreasury public treasury;
    IZNSDomainToken public domainToken;
    IZNSAddressResolver public addressResolver;


    modifier onlyNameOwner(bytes32 domainHash) {
        require(
            msg.sender == registry.getDomainOwner(domainHash),
            "ZNSEthRegistrar: Not the Owner of the Name"
        );
        _;
    }

    modifier onlyTokenOwner(bytes32 domainHash) {
        require(
            msg.sender == domainToken.ownerOf(uint256(domainHash)),
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
        setRegistry(znsRegistry_);
        setTreasury(znsTreasury_);
        setZnsDomainToken(znsDomainToken_);
        setAddressResolver(znsAddressResolver_);
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
            !registry.exists(domainHash),
            "ZNSEthRegistrar: Domain already exists"
        );

        // Staking logic
        treasury.stakeForDomain(domainHash, name, msg.sender, true);

        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);
        domainToken.register(msg.sender, tokenId);

        _setDomainData(domainHash, msg.sender, resolverContent);

        emit DomainRegistered(
            domainHash,
            tokenId,
            name,
            msg.sender,
            address(addressResolver)
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
        domainToken.revoke(tokenId);
        treasury.unstakeForDomain(domainHash, msg.sender);
        registry.deleteRecord(domainHash);

        emit DomainRevoked(domainHash, msg.sender);
    }

    function reclaimDomain(bytes32 domainHash)
    external
    override
    onlyTokenOwner(domainHash)
    {
        registry.updateDomainOwner(domainHash, msg.sender);

        emit DomainReclaimed(domainHash, msg.sender);
    }

    function setRegistry(address znsRegistry_) public override onlyAdmin {
        require(
            znsRegistry_ != address(0),
            "ZNSEthRegistrar: znsRegistry_ is 0x0 address"
        );
        registry = IZNSRegistry(znsRegistry_);

        emit RegistrySet(znsRegistry_);
    }

    function setTreasury(address znsTreasury_) public override onlyAdmin {
        require(
            znsTreasury_ != address(0),
            "ZNSEthRegistrar: znsTreasury_ is 0x0 address"
        );
        treasury = IZNSTreasury(znsTreasury_);

        emit TreasurySet(znsTreasury_);
    }

    function setZnsDomainToken(address znsDomainToken_) public override onlyAdmin {
        require(
            znsDomainToken_ != address(0),
            "ZNSEthRegistrar: znsDomainToken_ is 0x0 address"
        );
        domainToken = IZNSDomainToken(znsDomainToken_);

        emit DomainTokenSet(znsDomainToken_);
    }

    function setAddressResolver(address znsAddressResolver_) public override onlyAdmin {
        require(
            znsAddressResolver_ != address(0),
            "ZNSEthRegistrar: znsAddressResolver_ is 0x0 address"
        );
        addressResolver = IZNSAddressResolver(znsAddressResolver_);

        emit AddressResolverSet(znsAddressResolver_);
    }

    function setAccessController(address accessController_)
    external
    override(AccessControlled, IZNSEthRegistrar)
    onlyAdmin
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
            registry.createDomainRecord(domainHash, owner, address(addressResolver));
            addressResolver.setAddress(domainHash, resolverContent);
        } else {
            registry.createDomainRecord(domainHash, owner, address(0));
        }
    }
}
