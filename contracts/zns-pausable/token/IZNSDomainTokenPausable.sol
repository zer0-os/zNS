// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSDomainToken } from "../../token/IZNSDomainToken.sol";
import { IZNSPausable } from "../IZNSPausable.sol";


interface IZNSDomainTokenPausable is IZNSDomainToken, IZNSPausable {}
