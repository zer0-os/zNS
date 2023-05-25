// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSAccessController } from "./IZNSAccessController.sol";
import { ZNSRoles } from "./ZNSRoles.sol";

abstract contract AccessControlled {

    event AccessControllerSet(address accessController);

    IZNSAccessController internal accessController;

    modifier onlyAdmin() {
        accessController.checkAdmin(msg.sender);
        _;
    }

    modifier onlyGovernor() {
        accessController.checkGovernor(msg.sender);
        _;
    }

    modifier onlyExecutor() {
        accessController.checkExecutor(msg.sender);
        _;
    }

    modifier onlyRegistrar() {
        accessController.checkRegistrar(msg.sender);
        _;
    }

    /**
     * @dev These 2 virtual functions are here to make sure they are always implemented in children,
     * otherwise we will not be able to reset the module or read the AC address
     */
    function getAccessController() external view virtual returns (address);

    function setAccessController(address _accessController) external virtual;

    function _setAccessController(address _accessController) internal {
        require(_accessController != address(0), "AC: _accessController is 0x0 address");
        accessController = IZNSAccessController(_accessController);
        emit AccessControllerSet(_accessController);
    }
}
