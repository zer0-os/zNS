// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { IZNSAccessManager } from "./IZNSAccessManager.sol";
import { ZNSRoles } from "./ZNSRoles.sol";


contract ZNSAccessManager is AccessControlUpgradeable, ZNSRoles, IZNSAccessManager {
    function __ZNSAccessManager_init(
        // TODO AC: is there a better way to setup all the roles here param-wise?
        address superAdmin,
        address[] calldata governorAddresses,
        address[] calldata operatorAddresses
    ) internal onlyInitializing {
        // TODO AC: should this be msg.sender?
        require(superAdmin != address(0), "ZNSAM: Super Admin can not be 0 address!");
        /**
         * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
         * grant and revoke this role. Extra precautions should be taken to secure
         * accounts that have been granted it. (c) OZ
         */
        // TODO AC: check if we even need this at all
        _grantRole(DEFAULT_ADMIN_ROLE, superAdmin);

        // all of the governors control operators TODO AC: ???
        _setRoleAdmin(OPERATOR_ROLE, GOVERNOR_ROLE);
        // all of the governors control governors TODO AC: ???
        _setRoleAdmin(GOVERNOR_ROLE, GOVERNOR_ROLE);
        // all of the governors control registrar TODO AC: ???
        _setRoleAdmin(REGISTRAR_ROLE, GOVERNOR_ROLE);

        // give roles to all addresses
        _grantRoleToMany(GOVERNOR_ROLE, governorAddresses);
        _grantRoleToMany(OPERATOR_ROLE, operatorAddresses);
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
