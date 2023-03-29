// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IZNSDomainToken} from "./IZNSDomainToken.sol";

//TODO: Add Access Control
contract ZNSDomainToken is ERC721, IZNSDomainToken {
  constructor() ERC721("ZNSDomainToken", "ZDT") {}

  //Mints a token with a specified tokenId, using _safeMint, and sends it to the given address
  //TODO: Add Access Control
  function register(address to, uint256 tokenId) external {
    _safeMint(to, tokenId);
  }

  //Burns the token with the specified tokenId
  //TODO: Add Access Control, replace require to also allow registry to revoke
  function revoke(uint256 tokenId) external {
    require(
      msg.sender == ownerOf(tokenId),
      "ZNSDomainToken: Owner of sender does not match Owner of token"
    );
    _burn(tokenId);
  }
}
