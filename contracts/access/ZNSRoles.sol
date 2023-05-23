// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


abstract contract ZNSRoles {
    // TODO AC: test getting this from AC contract vs inheriting these roles in every other contract
    // the highest rank, only assigns Admins
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    // the main maintainer role, that gets access to all system functions
    // TODO AC: should we split responsibilities in a better way?
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // operator can be here to future proof, if we need a new role
    // so we don't have to upgrade all contracts
    // TODO AC: decide what to do with this role
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    // this role is here specifically for the ZNSEthRegistrar contract
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    // TODO AC: what other roles do we need here?
}
