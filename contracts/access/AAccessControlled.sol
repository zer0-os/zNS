// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSAccessController } from "./IZNSAccessController.sol";
import { ZeroAddressPassed, WrongAccessControllerAddress, NotAuthorized } from "../utils/CommonErrors.sol";
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ZNSRoles } from "./ZNSRoles.sol";


/**
 * @title This abstract contract outlines basic functionality, declares functions
 * that need to be implemented to provide a deterministic connection to `ZNSAccessController` module.
 * @dev In order to connect an arbitrary module to `ZNSAccessController` and it's functionality,
 * this contract needs to be inherited by the module.
 */
abstract contract AAccessControlled is ZNSRoles {
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
     * @notice Revert if `msg.sender` is not the `ZNSRootRegistrar.sol` contract
     * or an address holding REGISTRAR_ROLE.
     */
    modifier onlyRegistrar {
        accessController.checkRegistrar(msg.sender);
        _;
    }

    /**
     * @notice Universal getter for `accessController` address on any contract that
     * inherits from `AAccessControlled`.
     */
    function getAccessController() external view returns (address) {
        return address(accessController);
    }

    /**
     * @notice Universal setter for `accessController` address on any contract that
     * inherits from `AAccessControlled`.
     * Only ADMIN can call this function.
     * Fires `AccessControllerSet` event.
     * @param accessController_ The address of the new access controller
     */
    function setAccessController(address accessController_)
    external
    onlyAdmin {
        _setAccessController(accessController_);
    }

    /**
     * @notice Internal function to set the access controller address.
     * @param _accessController Address of the ZNSAccessController contract.
     */
    function _setAccessController(address _accessController) internal {
        // Validate if `msg.sender` has the admin role in the *current* contract
        if (accessController != IZNSAccessController(address(0))) {
            if (!IAccessControl(accessController).hasRole(ADMIN_ROLE, msg.sender)) {
                revert NotAuthorized(msg.sender);
            }
        }

        // Similarly, validate admin alignment in the *new* contract
        try IAccessControl(_accessController).hasRole(ADMIN_ROLE, msg.sender) returns (bool valid) {
            if (!valid) {
                revert WrongAccessControllerAddress(_accessController);
            }
        } catch {
            revert WrongAccessControllerAddress(_accessController);
        }

        accessController = IZNSAccessController(_accessController);
        emit AccessControllerSet(_accessController);
    }
}
