// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSAccessController } from "./IZNSAccessController.sol";


/**
 * @title This abstract contract outlines basic functionality, declares functions
 * that need to be implemented to provide a deterministic connection to `ZNSAccessController` module.
 * @dev In order to connect an arbitrary module to `ZNSAccessController` and it's functionality,
 * this contract needs to be inherited by the module.
 */
abstract contract AccessControlled {

    /**
     * @notice Emitted when the access controller contract address is set.
     */
    event AccessControllerSet(address accessController);

    /**
     * @notice Address of the ZNSAccessController contract.
     */
    IZNSAccessController internal accessController;

    /**
     * @notice Modifier to make a function callable only when caller is an admin.
     * Implemented here to avoid declaring this in every single contract that uses it.
     */
    modifier onlyAdmin() {
        accessController.checkAdmin(msg.sender);
        _;
    }

    /**
     * @notice Revert if `msg.sender` is not the `ZNSRegistrar` contract
     * or an address holding REGISTRAR_ROLE.
     */
    modifier onlyRegistrar {
        accessController.checkRegistrar(msg.sender);
        _;
    }

    /**
     * @notice Virtual function to make sure the getter is always implemented in children,
     * otherwise we will not be able to read the AC address in children
     */
    function getAccessController() external view virtual returns (address);

    /**
     * @notice Virtual function to make sure the setter is always implemented in children,
     * otherwise we will not be able to reset the AC address in children
     */
    function setAccessController(address _accessController) external virtual;

    /**
     * @notice Internal function to set the access controller address.
     * @param _accessController Address of the ZNSAccessController contract.
     */
    function _setAccessController(address _accessController) internal {
        require(_accessController != address(0), "AC: _accessController is 0x0 address");
        accessController = IZNSAccessController(_accessController);
        emit AccessControllerSet(_accessController);
    }
}
