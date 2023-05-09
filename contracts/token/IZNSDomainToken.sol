// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IZNSDomainToken is IERC721{
  event SetAccessAuthorization(address indexed account);

  function register(address to, uint256 tokenId) external;

  function revoke(uint256 tokenId) external;
  
  function authorize( address account) external;
}
