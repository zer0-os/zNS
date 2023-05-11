// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import {IERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IZNSDomainToken is IERC721Upgradeable {
  event SetAccessAuthorization(address indexed account);

  function register(address to, uint256 tokenId) external;

  function revoke(uint256 tokenId) external;
  
  function authorize( address account) external;
}