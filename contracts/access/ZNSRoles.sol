// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


abstract contract ZNSRoles {
    // the highest rank, only assigns Admins
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    // the main maintainer role, that gets access to all system functions
    // TODO AC: should we split responsibilities in a better way?
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // operator can be here to future proof, if we need a new role
    // so we don't have to upgrade all contracts
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    // this role is here specifically for the ZNSEthRegistrar contract
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    // TODO AC: what other roles do we need here?
}