// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


// TODO: can we declare these outside of contract, just in the ZNSAccessController file?
abstract contract ZNSRoles {
    // the highest rank, assigns Admins, new roles and Role Admins
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    // the main maintainer role, that gets access to all system functions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // operator can be here to future proof, if we need a new role
    // so we don't have to upgrade all contracts
    // TODO AC: possibly remove executor role?
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    // this role is here specifically for the ZNSRegistrar contract
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
}
