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


    mapping(bytes32 parentDomainHash =>
      mapping(address user => bool status)) public subdomainApprovals;

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
     * @notice Register a root domain such as `0://wilder`
     * @param name Name of the domain to register
     * @param resolver Address of the resolver for that domain (optional, send 0x0 if not needed)
     * @param domainAddress Address for the resolver to return when requested (optional, send 0x0 if not needed)
     */
    function registerRootDomain(
      string calldata name,
      address resolver,
      address domainAddress
    ) external override returns (bytes32) {
      require(bytes(name).length != 0, "ZNSEthRegistrar: Domain Name not provided");

        // To not repeat external calls, we load into memory
        bytes32 rootHash = znsRegistry.ROOT_HASH();

      // Create hash for given domain name
      bytes32 domainHash = hashWithParent(rootHash, name);

        require(
            !znsRegistry.exists(domainHash),
            "ZNSEthRegistrar: Domain already exists"
        );

        // Staking logic
        znsTreasury.stakeForDomain(domainHash, name, msg.sender, true);

        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);
        znsDomainToken.register(msg.sender, tokenId);

        // Because a "root" in our system is actually a top-level domain that is a subdomain
        // of the actual root address `0://`, we call `_setSubdomainData` with the parent hash as the root hash
        _setSubdomainData(
            rootHash,
            domainHash,
            msg.sender,
            resolver,
            domainAddress
        );

      emit DomainRegistered(
        rootHash,
        domainHash,
        tokenId,
        name,
        msg.sender,
        resolver
      );

        return domainHash;
    }

    /**
     * @notice Approve creation of subdomains for the parent domain
     * @param parentHash The hash of the parent domain name
     * @param user The allowed address
     * @param status The status of this user's approval
     */
    function setSubdomainApproval(
      bytes32 parentHash,
      address user,
      bool status
    ) public override onlyNameOwner(parentHash) {
      subdomainApprovals[parentHash][user] = status;

        emit SubdomainApprovalSet(parentHash, user, status);
    }

    function registerSubdomain(
      bytes32 parentDomainHash,
      string calldata name,
      address registrant,
      address resolver,
      address domainAddress
    ) external override returns (bytes32) {
      require(bytes(name).length != 0, "ZNSEthRegistrar: No subdomain name");

        bytes32 domainHash = hashWithParent(parentDomainHash, name);

        require(
            !znsRegistry.exists(domainHash),
            "ZNSEthRegistrar: Domain already exists"
        );

        address registerFor = registrant;

        // Here if the caller is an owner or an operator
        // (where a Registrar contract can be any of those),
        // we do not need to check the approval.
        if (!znsRegistry.isOwnerOrOperator(parentDomainHash, msg.sender)) {
            require(
                subdomainApprovals[parentDomainHash][msg.sender],
                "ZNSEthRegistrar: Subdomain purchase is not authorized for this account"
            );

            registerFor = msg.sender;

            // We remove subdomain approval immediately after it is used
            setSubdomainApproval(parentDomainHash, msg.sender, false);
        }

        znsTreasury.stakeForDomain(
            domainHash,
            name,
            msg.sender,
            false
        );

        uint256 tokenId = uint256(domainHash);
        znsDomainToken.register(msg.sender, tokenId);

        _setSubdomainData(
            parentDomainHash,
            domainHash,
            registerFor,
            resolver,
            domainAddress
        );

        emit DomainRegistered(
            parentDomainHash,
            domainHash,
            tokenId,
            name,
            registerFor,
            resolver
        );

        return domainHash;
    }

    function revokeDomain(bytes32 domainHash)
    external
    override
    onlyNameOwner(domainHash)
    onlyTokenOwner(domainHash)
    {
      uint256 tokenId = uint256(domainHash);
      znsDomainToken.revoke(tokenId);
      znsTreasury.unstakeForDomain(domainHash, msg.sender);
      znsRegistry.deleteRecord(domainHash);

      emit DomainRevoked(domainHash, msg.sender);
    }

    function reclaimDomain(bytes32 domainHash) external override onlyTokenOwner(domainHash) {
      znsRegistry.setSubdomainOwner(znsRegistry.ROOT_HASH(), domainHash, msg.sender);

      emit DomainReclaimed(domainHash, msg.sender);
    }

    function hashWithParent(
      bytes32 parentHash,
      string calldata name
    ) public pure override returns (bytes32) {
      return keccak256(
        abi.encodePacked(
          parentHash,
          keccak256(bytes(name))
        )
      );
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

    function _setSubdomainData(
      bytes32 parentDomainHash,
      bytes32 domainHash,
      address owner,
      address resolver,
      address domainAddress
    ) internal {
        // If no resolver is given, require no domain data exists either
        if (resolver == address(0)) {
            require(
              domainAddress == address(0),
              "ZNSEthRegistrar: Domain content provided without a valid resolver address"
            );
            // Set only the domain owner
            // TODO: rework these calls when Registry ABI has been changed
            znsRegistry.setSubdomainOwner(parentDomainHash, domainHash, owner);
        } else {
            // If a valid resolver is given, require domain data as well
            require(
              domainAddress != address(0),
              "ZNSEthRegistrar: No domain content provided"
            );
            // TODO: what if the given Resolver already exists?
            //  we do not want to re-set it again in Registry storage
            //  iron this out!
            znsRegistry.setSubdomainRecord(
              parentDomainHash,
              domainHash,
              owner,
              resolver
            );
            // TODO error: we are using a different Resolver here than the one passed!
            //  and the one in the call above. This is an error that can cause undiscoverable domains
            //  If we only have one AddressResolver, we should not take it as an argument
            //  to the register function at all and assume the one in this storage is being used
            znsAddressResolver.setAddress(domainHash, domainAddress);
        }
    }
}
