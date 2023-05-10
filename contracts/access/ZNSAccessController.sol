// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { IZNSAccessController } from "./IZNSAccessController.sol";
import { ZNSRoles } from "./ZNSRoles.sol";


contract ZNSAccessController is AccessControlUpgradeable, ZNSRoles, IZNSAccessController {
    // TODO AC: make the initial role setup in this function better!
    // solhint-disable-next-line func-name-mixedcase
    function initialize(
        // TODO AC: is there a better way to setup all the roles here param-wise?
        address[] calldata governorAddresses,
        address[] calldata adminAddresses
    ) external override initializer {
        // all of the governors control admins TODO AC: ???
        _setRoleAdmin(ADMIN_ROLE, GOVERNOR_ROLE);
        // all of the governors control governors TODO AC: ???
        _setRoleAdmin(GOVERNOR_ROLE, GOVERNOR_ROLE);
        // all of the admins control registrar TODO AC: ???
        _setRoleAdmin(REGISTRAR_ROLE, ADMIN_ROLE);

        // give roles to all addresses
        _grantRoleToMany(GOVERNOR_ROLE, governorAddresses);
        _grantRoleToMany(ADMIN_ROLE, adminAddresses);
    }

    // TODO AC: should we keep this function here so that we can get standardized message?
    function checkRole(bytes32 role, address account) external view override {
        _checkRole(role, account);
    }

    // TODO AC: is this function necessary? how often will it be used?
    function _grantRoleToMany(bytes32 role, address[] calldata addresses) internal {
        for (uint256 i = 0; i < addresses.length; i++) {
            _grantRole(role, addresses[i]);
        }
    }
}
