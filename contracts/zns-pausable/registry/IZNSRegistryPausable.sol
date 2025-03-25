// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSRegistry } from "../../registry/IZNSRegistry.sol";
import { IZNSPausable } from "../IZNSPausable.sol";


interface IZNSRegistryPausable is IZNSRegistry, IZNSPausable {}
