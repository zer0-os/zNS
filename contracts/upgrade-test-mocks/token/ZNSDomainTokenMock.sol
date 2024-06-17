// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { ZNSDomainToken } from "../../token/ZNSDomainToken.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSDomainTokenUpgradeMock is ZNSDomainToken, UpgradeMock {
    constructor(
        address accessController_,
        string memory name_,
        string memory symbol_,
        address defaultRoyaltyReceiver,
        uint96 defaultRoyaltyFraction
    ) ZNSDomainToken(accessController_, name_, symbol_, defaultRoyaltyReceiver, defaultRoyaltyFraction) {}
}
