// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


import { IZNSAccessController } from "./IZNSAccessController.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";


/**
 * @title This abstract contract outlines basic functionality, declares functions
 * that need to be implemented to provide a deterministic connection to `ZNSAccessController` module.
 *
 * @dev In order to connect an arbitrary module to `ZNSAccessController` and it's functionality,
 * this contract needs to be inherited by the module.
 */
abstract contract AAccessControlled {
    /**
     * @notice Emitted when the access controller contract address is set.
     */
    event AccessControllerSet(address accessController);

    /**
     * @notice Reverts when the access controller is set to an incorrect address.
     *
     * @param accessController The address that was attempted to be set as the access controller.
     */
    error WrongAccessControllerAddress(address accessController);

    /**
     * @notice Address of the `ZNSAccessController` contract.
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
     *
     * @param accessController_ The address of the new access controller
     */
    function setAccessController(address accessController_)
    external
    {
        _setAccessController(accessController_);
    }

    /**
     * @notice Internal function to set the access controller address.
     *
     * @dev This function checks if the caller has the GOVERNOR_ROLE in the current
     * in-state contract and checks if the new access controller address passed is in fact a `ZNSAccessController`
     * contract that is already set up with the same caller as GOVERNOR. This prevents from setting the wrong address.
     *
     * @param _accessController Address of the ZNSAccessController contract.
     */
    function _setAccessController(address _accessController) internal {
        // Validate if `msg.sender` has the governor role in the *current* in-state contract
        if (address(accessController) != address(0)) {
            if (!IAccessControl(accessController).hasRole(accessController.GOVERNOR_ROLE(), msg.sender)) {
                revert IAccessControl.AccessControlUnauthorizedAccount(msg.sender, accessController.GOVERNOR_ROLE());
            }
        }

        // Similarly, validate governor alignment in the *new* contract
        if (_accessController.code.length != 0) {
            try IZNSAccessController(_accessController).GOVERNOR_ROLE() returns (bytes32 governorRole) {
                if (!IAccessControl(_accessController).hasRole(governorRole, msg.sender)) {
                    revert IAccessControl.AccessControlUnauthorizedAccount(msg.sender, governorRole);
                }
            } catch {
                revert WrongAccessControllerAddress(_accessController);
            }
        } else {
            revert WrongAccessControllerAddress(_accessController);
        }

        accessController = IZNSAccessController(_accessController);
        emit AccessControllerSet(_accessController);
    }
}
