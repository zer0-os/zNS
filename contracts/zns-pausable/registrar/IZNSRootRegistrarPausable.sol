// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSRootRegistrar } from "../../registrar/IZNSRootRegistrar.sol";
import { IZNSPausable } from "../IZNSPausable.sol";


interface IZNSRootRegistrarPausable is IZNSRootRegistrar, IZNSPausable {}
