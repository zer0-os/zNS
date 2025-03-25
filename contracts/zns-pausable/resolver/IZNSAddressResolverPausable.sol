// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSAddressResolver } from "../../resolver/IZNSAddressResolver.sol";
import { IZNSPausable } from "../IZNSPausable.sol";


interface IZNSAddressResolverPausable is IZNSAddressResolver, IZNSPausable {}
