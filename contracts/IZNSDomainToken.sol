// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSDomainToken {
  //event ZNSRegistrychanged(address value);

  // TODO
  /** Add Documentation
   */

  function register(address to, uint256 tokenId) external;

  // function reclaim(uint256 tokenId) external;

  function revoke(uint256 tokenId) external;
}
