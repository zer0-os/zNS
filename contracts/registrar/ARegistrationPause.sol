// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSAccessController } from "../access/IZNSAccessController.sol";


abstract contract ARegistrationPause {
    /**
     * @notice Emitted when the public registration pause is set.
     *
     * @param isPaused The new value of the registration pause flag.
     */
    event RegistrationPauseSet(bool isPaused);

    /**
     * @notice Reverted when registration is paused and the caller is not an ADMIN.
     */
    error PublicRegistrationPaused();

    /**
     * @notice Reverted when trying to set the registration pause to the same value.
     */
    error ResettingToSameValue(bool curValue);

    /**
     * @notice Boolean flag to pause public registration of new domains.
     *
     * @dev When this flag is active, only ZNS ADMINs can register new domains.
     */
    bool public registrationPaused;

    /**
     * @notice Modifier to make a function publicly callable only when registration is not paused.
     * If registration is paused, only ADMINs can call the function.
     */
    modifier whenRegNotPaused(IZNSAccessController accessController) {
        if (registrationPaused) {
            if (!accessController.isAdmin(msg.sender))
                revert PublicRegistrationPaused();
        }
        _;
    }

    function _setRegistrationPause(
        bool isPaused
    ) internal {
        if (registrationPaused == isPaused)
            revert ResettingToSameValue(registrationPaused);

        registrationPaused = isPaused;

        emit RegistrationPauseSet(isPaused);
    }
}
