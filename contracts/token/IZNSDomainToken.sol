// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSDomainToken {
  event SetAccessAuthorization(address indexed account);

  function register(address to, uint256 tokenId) external;

  function revoke(uint256 tokenId) external;

  function isOwner(uint256 tokenId, address candidate) external view returns (bool);
  
  function authorize( address account) external;
}
