// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library Utility {
  function hashWithParent(
    bytes32 parentHash,
    string calldata name
  ) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(parentHash, keccak256(bytes(name))));
  }
}
