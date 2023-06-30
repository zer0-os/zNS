// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { IZNSAccessController } from "./IZNSAccessController.sol";
import { ZNSRoles } from "./ZNSRoles.sol";


contract ZNSAccessController is AccessControlUpgradeable, ZNSRoles, IZNSAccessController {
    // solhint-disable-next-line func-name-mixedcase
    function initialize(
        address[] calldata governorAddresses,
        address[] calldata adminAddresses
    ) external override initializer {
        // give roles to all addresses
        _grantRoleToMany(GOVERNOR_ROLE, governorAddresses);
        _grantRoleToMany(ADMIN_ROLE, adminAddresses);

        // all of the governors control admins
        _setRoleAdmin(ADMIN_ROLE, GOVERNOR_ROLE);
        // all of the governors control governors
        _setRoleAdmin(GOVERNOR_ROLE, GOVERNOR_ROLE);
        // all of the admins control registrar
        _setRoleAdmin(REGISTRAR_ROLE, ADMIN_ROLE);
    }

    // ** Access Validators **
    function checkGovernor(address account) external view override {
        _checkRole(GOVERNOR_ROLE, account);
    }

    function checkAdmin(address account) external view override {
        _checkRole(ADMIN_ROLE, account);
    }

    function checkExecutor(address account) external view override {
        _checkRole(EXECUTOR_ROLE, account);
    }

    function checkRegistrar(address account) external view override {
        _checkRole(REGISTRAR_ROLE, account);
    }

    function isAdmin(address account) external view override returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    function isRegistrar(address account) external view override returns (bool) {
        return hasRole(REGISTRAR_ROLE, account);
    }

    function _grantRoleToMany(bytes32 role, address[] calldata addresses) internal {
        for (uint256 i = 0; i < addresses.length; i++) {
            _grantRole(role, addresses[i]);
        }
    }

    function setRoleAdmin(bytes32 role, bytes32 adminRole) external override onlyRole(GOVERNOR_ROLE) {
        _setRoleAdmin(role, adminRole);
    }
}
