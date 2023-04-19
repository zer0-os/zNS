// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSRoles } from "./ZNSRoles.sol";
import { IZNSAccessManager } from "./IZNSAccessManager.sol";


abstract contract AccessControlled is ZNSRoles {
    event AccessManagerSet(address accessManager);

    IZNSAccessManager internal accessManager;

    modifier onlyRole(bytes32 role) {
        accessManager.checkRole(role, msg.sender);
        _;
    }

    /**
     * @dev This is here to make sure the external function is always implemented in children,
     * otherwise we will not be able to reset the module (not ideal since it might
     * not get to the final interface of a child).
     * TODO AC: how do we make sure this gets to the final interface?
     */
    function setAccessManager(address _accessManager) external;

    function setAccessManager(address _accessManager) internal {
        require(_accessManager != address(0), "AC: _accessManager is 0x0 address");
        accessManager = IZNSAccessManager(_accessManager);
    }
}
