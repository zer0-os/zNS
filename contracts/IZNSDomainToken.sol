// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import {IZNSRegistry} from "./IZNSRegistry.sol";

interface IZNSDomainToken {
  event ZNSRegistrychanged(address value);

  // TODO
  /**
   */
  function transfer(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) external;

  function register(
    address to_,
    uint256 tokenId_,
    bytes32 domainNameHash_,
    address resolver_
  ) external;

  function reclaim(uint256 tokenId) external;

  function revoke(uint256 tokenId) external;

  function setZNSRegistry(IZNSRegistry registry) external;
}
