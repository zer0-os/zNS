// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract Namehash {
    function getNamehash(string memory domain) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(abi.encodePacked(bytes32(0), keccak256(abi.encodePacked('eth')))), keccak256(abi.encodePacked(domain))));
    }
}