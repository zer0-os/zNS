// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSRoles } from "./ZNSRoles.sol";
import { IZNSAccessController } from "./IZNSAccessController.sol";


abstract contract AccessControlled is ZNSRoles {
    event AccessControllerSet(address accessController);

    IZNSAccessController internal accessController;

    modifier onlyRole(bytes32 role) {
        accessController.checkRole(role, msg.sender);
        _;
    }

    /**
     * @dev This is here to make sure the external function is always implemented in children,
     * otherwise we will not be able to reset the module (not ideal since it might
     * not get to the final interface of a child).
     * TODO AC: how do we make sure this gets to the final interface?
     */
    function setAccessController(address _accessController) external virtual;

    function getAccessController() external view returns (address) {
        return address(accessController);
    }

    function _setAccessController(address _accessController) internal {
        require(_accessController != address(0), "AC: _accessController is 0x0 address");
        accessController = IZNSAccessController(_accessController);
        emit AccessControllerSet(_accessController);
    }
}
