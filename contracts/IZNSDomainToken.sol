// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSDomainToken {
  function register(address to, uint256 tokenId) external;

  function revoke(uint256 tokenId) external;
}
