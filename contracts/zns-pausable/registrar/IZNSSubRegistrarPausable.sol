// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSSubRegistrar } from "../../registrar/IZNSSubRegistrar.sol";
import { IZNSPausable } from "../IZNSPausable.sol";


interface IZNSSubRegistrarPausable is IZNSSubRegistrar, IZNSPausable {}
