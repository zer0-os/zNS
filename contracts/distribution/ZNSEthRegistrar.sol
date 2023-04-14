// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSEthRegistrar } from "./IZNSEthRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSAddressResolver } from "../resolver/IZNSAddressResolver.sol";
import { Utility } from "../utils/Utility.sol";

contract ZNSEthRegistrar is IZNSEthRegistrar {
  // TODO:    this is here temporarily, figure out where this should be and how to set it up !
  bytes32 public constant ETH_ROOT_HASH = keccak256(bytes("0xETH://"));

  IZNSRegistry public znsRegistry;
  IZNSTreasury public znsTreasury;
  IZNSDomainToken public znsDomainToken; // TODO: add token here when ready along with import
  IZNSAddressResolver public znsAddressResolver;

  // why do we need this?
  mapping(bytes32 => address) private subdomainApprovals;

  // TODO: add events

  modifier onlyOwner(bytes32 domainNameHash) {
    require(msg.sender == znsRegistry.getDomainOwner(domainNameHash));
    _;
  }

  constructor(
    address znsRegistry_,
    address znsTreasury_,
    address znsDomainToken_,
    address znsAddressResolver_
  ) {
    // TODO: consider removing require messsages altogether. what would we have instead?
    require(
      znsRegistry_ != address(0),
      "ZNSEthRegistrar: Zero address passed as _znsRegistry"
    );
    require(
      znsDomainToken_ != address(0),
      "ZNSEthRegistrar: Zero address passed as _znsDomainToken"
    );
    require(
      znsTreasury_ != address(0),
      "ZNSEthRegistrar: Zero address passed as _znsTreasury"
    );

    znsRegistry = IZNSRegistry(znsRegistry_);
    znsTreasury = IZNSTreasury(znsTreasury_);
    znsDomainToken = IZNSDomainToken(znsDomainToken_);
    znsAddressResolver = IZNSAddressResolver(znsAddressResolver_);
  }

  // TODO:    Do we only allow address type of content here? How do we set other types here?
  //          Would we need to do separate calls from a wallet to a certain Resolver after we've registered a domain?
  function registerRootDomain(
    string calldata name,
    address resolver,
    address domainAddress
  ) external returns (bytes32) {
    require(bytes(name).length != 0, "ZNSEthRegistrar: No domain name");

    // Create hash for given domain name
    bytes32 domainHash = Utility.hashWithParent(ETH_ROOT_HASH, name);
    require(
      !znsRegistry.exists(domainHash),
      "ZNSEthRegistrar: Domain already exists"
    );

    // do all the staking logic
    znsTreasury.stakeForDomain(domainHash, name, msg.sender, true);

    // get tokenId for the new token to be minted for the new domain
    uint256 tokenId = uint256(domainHash);
    znsDomainToken.register(msg.sender, tokenId);

    // set data on Registry and Resolver storage
    _setDomainData(domainHash, msg.sender, resolver, domainAddress);

    emit RootDomainRegistered(domainHash, name, msg.sender);

    return domainHash;
  }

  // seems like maybe this is overwriting some of the
  // functionality from the registry?
  // basically just allowing a third authority to call to register
  function approveSubdomain(
    bytes32 parentHash,
    address ownerCandidate
  ) external onlyOwner(parentHash) {
    subdomainApprovals[parentHash] = ownerCandidate;
    emit SubdomainApproved(parentHash, ownerCandidate);
  }

  function registerSubdomain(
    bytes32 parentHash,
    string calldata name,
    address registrant,
    address resolver,
    address domainAddress
  ) external returns (bytes32) {
    // TODO:    Should we add interface check here that every Registrar should implement
    //          to only run the below require if an EOA is calling this?
    //          We do not need a subdomain approval if it's a Registrar
    //          contract calling this since the call from it already
    //          serves as an "approval".

    // Already in calldata, why reassign?
    address registerFor = registrant;
    // Here if the caller is an owner or an operator
    // (where a Registrar contract can be any of those),
    // we do not need to check the approval.
    if (!znsRegistry.isOwnerOrOperator(parentHash, msg.sender)) {
      require(
        subdomainApprovals[parentHash] == msg.sender,
        "ZNSEthRegistrar: Subdomain purchase is not authorized for this account"
      );

      registerFor = msg.sender;
    }

    bytes32 domainHash = Utility.hashWithParent(parentHash, name);

    // TODO: do we have burning here or just for Root Domains?
    // we are always charging the caller here
    // RDO Registrar if present or direct buyer/caller if no RDO Registrar
    znsTreasury.stakeForDomain(domainHash, name, msg.sender, false);

    uint tokenId = uint(domainHash);

    znsDomainToken.register(msg.sender, tokenId);

    _setDomainData(domainHash, registerFor, resolver, domainAddress);

    // We create a tokenId and call znsDomainToken.registerFor
    // for above rootDomain function, why not here?
    // should we?
    emit SubdomainRegistered(domainHash, parentHash, name, registerFor);

    return domainHash;
  }

  function revokeDomain(bytes32 domainHash) external onlyOwner(domainHash) {
    // TODO: is this necessary?
    require(
      znsRegistry.exists(domainHash),
      "ZNSEthRegistrar: Domain does not exist"
    );

    uint256 tokenId = uint256(domainHash);

    znsDomainToken.revoke(tokenId);

    znsRegistry.deleteDomainRecord(domainHash);

    znsTreasury.unstakeForDomain(domainHash, msg.sender);

    emit DomainRevoked(domainHash, msg.sender);

    // TODO: what are we missing here?
  }

  function _setDomainData(
    bytes32 domainHash,
    address owner,
    address resolver,
    address domainAddress
  ) internal {
    // If no resolver given, require no domain data exists either
    if (resolver == address(0)) {
      require(
        domainAddress == address(0),
        "ZNSEthRegistrar: Domain content provided without a valid resolver address"
      );

      znsRegistry.setDomainOwner(domainHash, owner);
    } else {
      // If valid resolver given, require domain data as well
      require(
        domainAddress != address(0),
        "ZNSEthRegistrar: No domain content provided"
      );
      znsRegistry.setDomainRecord(domainHash, owner, resolver);
      znsAddressResolver.setAddress(domainHash, domainAddress);
    }
  }
}
