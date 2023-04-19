// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


abstract contract ZNSRoles {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    // TODO AC: what other roles do we need here?
}
