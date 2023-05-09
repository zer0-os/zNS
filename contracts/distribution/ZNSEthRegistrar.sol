// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSEthRegistrar } from "./IZNSEthRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSAddressResolver } from "../resolver/IZNSAddressResolver.sol";
import { IZNSPriceOracle } from "./IZNSPriceOracle.sol";


contract ZNSEthRegistrar is IZNSEthRegistrar {

  IZNSRegistry public znsRegistry;
  IZNSTreasury public znsTreasury;
  IZNSDomainToken public znsDomainToken;
  IZNSAddressResolver public znsAddressResolver;
  IZNSPriceOracle public znsPriceOracle;


  mapping(bytes32 parentDomainHash => mapping(address user => bool status))
    public subdomainApprovals;

  modifier onlyOwner(bytes32 domainNameHash) {
    require(msg.sender == znsRegistry.getDomainOwner(domainNameHash), "ZNSEthRegistrar: Not the Domain Owner" );
    _;
  }

  /**
   * @notice Create an instance of the ZNSEthRegistrar
   * for registering ZNS domains and subdomains
   */
  constructor(
    IZNSRegistry znsRegistry_,
    IZNSTreasury znsTreasury_,
    IZNSDomainToken znsDomainToken_,
    IZNSAddressResolver znsAddressResolver_,
    IZNSPriceOracle znsPriceOracle_
  ) {
    znsRegistry = znsRegistry_;
    znsTreasury = znsTreasury_;
    znsDomainToken = znsDomainToken_;
    znsAddressResolver = znsAddressResolver_;
    znsPriceOracle = znsPriceOracle_;
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
  ) external returns (bytes32) {
    require(bytes(name).length != 0, "ZNSEthRegistrar: Domain Name not provided");

    // To not repeat external calls, we load into memory
    bytes32 rootHash = znsRegistry.ROOT_HASH();

    // Create hash for given domain name
    // TODO: remove hashing with the rootHash and remove root hash completel!
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

    // TODO Is it useful to register with a specific ROOT_HASH
    // value vs. just address(0)? What are pros and cons?
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
  ) public onlyOwner(parentHash) {
    subdomainApprovals[parentHash][user] = status;

    emit SubdomainApprovalSet(parentHash, user, status);
  }

  function registerSubdomain(
    bytes32 parentDomainHash,
    string calldata name,
    address registrant,
    address resolver,
    address domainAddress
  ) external returns (bytes32) {
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

  function revokeDomain(bytes32 domainHash) external onlyOwner(domainHash) {
    uint256 tokenId = uint256(domainHash);
    znsDomainToken.revoke(tokenId);
    znsTreasury.unstakeForDomain(domainHash, msg.sender);
    znsRegistry.deleteRecord(domainHash);

    emit DomainRevoked(domainHash, msg.sender);

    // TODO: what are we missing here?
  }

  //TODO: Access Control
  function reclaimDomain(bytes32 domainHash) external {
    require(
      znsRegistry.exists(domainHash),
      "ZNSEthRegistrar: Domain does not exist"
    );
    uint256 tokenId = uint256(domainHash);
    require(znsDomainToken.ownerOf(tokenId) == msg.sender, "ZNSEthRegistrar: Not owner of Token");
    address owner = znsRegistry.getDomainRecord(domainHash).owner;
    require(owner != msg.sender, "ZNSEthRegistrar: Domain is already owned by the caller");
    znsRegistry.setSubdomainOwner(znsRegistry.ROOT_HASH(), domainHash, msg.sender);
    
    emit DomainReclaimed(domainHash, msg.sender);
  }

  function hashWithParent(
    bytes32 parentHash,
    string calldata name
  ) public pure returns (bytes32) {
    return keccak256(
      abi.encodePacked(
        parentHash,
        keccak256(bytes(name))
      )
    );
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
      // TODO: what is the given Resolver already exists?
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
