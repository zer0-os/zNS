// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


// TODO multi: what is the best name for this ???
struct RegistrationProof {
    address domainOwner;
    bytes32 domainHash;
    bytes32 parentHash;
    string label;
    string tokenUri;
}
