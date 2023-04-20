// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IZNSEthRegistrar} from "./IZNSEthRegistrar.sol";
import {IZNSRegistry} from "../registry/IZNSRegistry.sol";
import {IZNSTreasury} from "./IZNSTreasury.sol";
import {IZNSDomainToken} from "../token/IZNSDomainToken.sol";
import {IZNSAddressResolver} from "../resolver/IZNSAddressResolver.sol";
import {IZNSPriceOracle} from "./IZNSPriceOracle.sol";

contract ZNSEthRegistrar is IZNSEthRegistrar {
  IZNSRegistry public znsRegistry;
  IZNSTreasury public znsTreasury;
  IZNSDomainToken public znsDomainToken;
  IZNSAddressResolver public znsAddressResolver;
  IZNSPriceOracle public znsPriceOracle;

  mapping(bytes32 => address) private subdomainApprovals;

  modifier onlyOwner(bytes32 domainNameHash) {
    require(msg.sender == znsRegistry.getDomainOwner(domainNameHash));
    _;
  }

  constructor(
    address znsRegistry_,
    address znsTreasury_,
    address znsDomainToken_,
    address znsAddressResolver_,
    address znsPriceOracle_
  ) {
    znsRegistry = IZNSRegistry(znsRegistry_);
    znsTreasury = IZNSTreasury(znsTreasury_);
    znsDomainToken = IZNSDomainToken(znsDomainToken_);
    znsAddressResolver = IZNSAddressResolver(znsAddressResolver_);
    znsPriceOracle = IZNSPriceOracle(znsPriceOracle_);
  }

  // TODO:    Do we only allow address type of content here? How do we set other types here?
  //          Would we need to do separate calls from a wallet to a certain Resolver after we've registered a domain?
  function registerRootDomain(
    string calldata name,
    address resolver,
    address domainAddress
  ) external returns (bytes32) {
    require(bytes(name).length != 0, "ZNSEthRegistrar: No domain name");

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

    // get tokenId for the new token to be minted for the new domain
    uint256 tokenId = uint256(domainHash);
    znsDomainToken.register(msg.sender, tokenId);

    // Because a "root" in our system is technically still a subdomain of the `0://` address
    // we call `_setSubdomainData` with the parent hash as the root hash
    _setSubdomainData(
      rootHash,
      domainHash,
      msg.sender,
      resolver,
      domainAddress
    );

    emit RootDomainRegistered(domainHash, tokenId, name, msg.sender, resolver);

    return domainHash;
  }

  function approveSubdomain(
    bytes32 parentHash,
    address ownerCandidate
  ) external onlyOwner(parentHash) {
    subdomainApprovals[parentHash] = ownerCandidate;
    emit SubdomainApproved(parentHash, ownerCandidate);
  }

  function registerSubdomain(
    bytes32 parentDomainHash, // wilder
    string calldata name, // world
    address registrant, // user
    address resolver, // addressResolver
    address domainAddress // value
  ) external returns (bytes32) {
    require(bytes(name).length != 0, "ZNSEthRegistrar: No subdomain name");

    // TODO:    Should we add interface check here that every Registrar should implement
    //          to only run the below require if an EOA is calling this?
    //          We do not need a subdomain approval if it's a Registrar
    //          contract calling this since the call from it already
    //          serves as an "approval".

    address registerFor = registrant;
    // Here if the caller is an owner or an operator
    // (where a Registrar contract can be any of those),
    // we do not need to check the approval.
    if (!znsRegistry.isOwnerOrOperator(parentDomainHash, msg.sender)) {
      require(
        subdomainApprovals[parentDomainHash] == msg.sender,
        "ZNSEthRegistrar: Subdomain purchase is not authorized for this account"
      );

      registerFor = msg.sender;
    }

    bytes32 domainHash = hashWithParent(parentDomainHash, name);

    require(
      !znsRegistry.exists(domainHash),
      "ZNSEthRegistrar: Domain already exists"
    );
    // TODO: do we have burning here or just for Root Domains?
    // we are always charging the caller here
    // RDO Registrar if present or direct buyer/caller if no RDO Registrar
    znsTreasury.stakeForDomain(domainHash, name, msg.sender, false);

    uint256 tokenId = uint256(domainHash);
    znsDomainToken.register(msg.sender, tokenId);

    // TODO because the registry hashes again, the emit below is inaccurate
    _setSubdomainData(
      parentDomainHash,
      domainHash,
      registerFor,
      resolver,
      domainAddress
    );

    // We create a tokenId and call znsDomainToken.registerFor
    // for above rootDomain function, why not here?
    // should we?
    emit SubdomainRegistered(
      domainHash,
      parentDomainHash,
      tokenId,
      name,
      registerFor,
      resolver
    );

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

  function hashWithParent(
    bytes32 parentHash,
    string calldata name
  ) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(parentHash, keccak256(bytes(name))));
  }

  function _setSubdomainData(
    bytes32 parentDomainHash,
    bytes32 domainHash, // probably change, this is readable name i think
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
      znsRegistry.setSubdomainOwner(parentDomainHash, domainHash, owner);
    } else {
      // If valid resolver given, require domain data as well
      require(
        domainAddress != address(0),
        "ZNSEthRegistrar: No domain content provided"
      );
      znsRegistry.setSubdomainRecord(
        parentDomainHash,
        domainHash,
        owner,
        resolver
      );
      znsAddressResolver.setAddress(domainHash, domainAddress);
    }
  }
}
