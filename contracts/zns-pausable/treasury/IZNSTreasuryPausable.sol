// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSTreasury } from "../../treasury/IZNSTreasury.sol";
import { IZNSPausable } from "../IZNSPausable.sol";


interface IZNSTreasuryPausable is IZNSTreasury, IZNSPausable {}
