// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


import { IZNSRoles } from "./IZNSRoles.sol";


/**
 * @title Outlines the roles used in the ZNS system
 * @dev > Inherited ONLY by `ZNSAccessController`
 */
abstract contract ZNSRoles is IZNSRoles {
    /**
     * @notice The highest rank, assigns Admins, new roles and Role Admins
     */
    bytes32 public constant override GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    /**
     * @notice The main maintainer role, that gets access to all system functions
     */
    bytes32 public constant override ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /**
     * @notice This role is here specifically for the ZNSRootRegistrar.sol contract
     */
    bytes32 public constant override REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /**
     * @notice This role is here specifically for the ZNSDomainToken.sol contract
     */
    bytes32 public constant override DOMAIN_TOKEN_ROLE = keccak256("DOMAIN_TOKEN_ROLE");

    /**
     * @notice Executor can be here to future proof, if we need a new role
     * so we don't have to upgrade all contracts
     */
    bytes32 public constant override EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
}
