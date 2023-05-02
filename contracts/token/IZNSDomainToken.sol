// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSDomainToken {
  event SetAccessAuthorization(address indexed account);

  function register(address to, uint256 tokenId) external;

  function revoke(uint256 tokenId) external;

  function authorize( address account) external;
}
