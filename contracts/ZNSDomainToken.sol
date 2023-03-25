// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol"; //For Token Ids
import {IZNSDomainToken} from "./IZNSDomainToken.sol";
import {IZNSRegistry} from "./IZNSRegistry.sol";

contract ZNSDomainToken is IZNSDomainToken, ERC721 {
  //ZNS Registry
  IZNSRegistry public ZNSRegistry;
  mapping(uint256 => bytes32) public records;

  constructor() ERC721("ZNSDomainToken", "ZDT") {}

  function transfer(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) external {}

  // Set the price of this sale
  //TODO: Add Access Control
  function setZNSRegistry(IZNSRegistry ZNSRegistry_) external override {
    ZNSRegistry = ZNSRegistry_;
    emit ZNSRegistrychanged(address(ZNSRegistry_));
  }

  //TODO: Add Access Control
  function register(
    address to,
    uint256 tokenId,
    bytes32 domainNameHash,
    address resolver
  ) external {
    _safeMint(to, tokenId);
    ZNSRegistry.createDomainRecord(domainNameHash, resolver);
    records[tokenId] = domainNameHash;
  }

  //TODO: Add Access Control
  function reclaim(uint256 tokenId) external {
    require(
      msg.sender == ownerOf(tokenId),
      "ERC721: Owner of sender does not match Owner of token"
    );
    bytes32 domainNameHash = records[tokenId];
    ZNSRegistry.setDomainOwner(domainNameHash, msg.sender);
  }

  //TODO: Add Access Control
  function revoke(uint256 tokenId) external {
    require(
      msg.sender == ownerOf(tokenId),
      "ERC721: Owner of sender does not match Owner of token"
    );
    _burn(tokenId);
  }
}
