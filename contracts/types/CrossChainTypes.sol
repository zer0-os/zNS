// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


struct BridgedDomain {
    bytes32 domainHash;
    bytes32 parentHash;
    string label;
    address domainOwner;
    string tokenUri;
}
