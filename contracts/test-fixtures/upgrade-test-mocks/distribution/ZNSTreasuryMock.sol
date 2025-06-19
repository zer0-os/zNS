// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ZNSTreasury } from "../../../treasury/ZNSTreasury.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSTreasuryUpgradeMock is ZNSTreasury, UpgradeMock {}
