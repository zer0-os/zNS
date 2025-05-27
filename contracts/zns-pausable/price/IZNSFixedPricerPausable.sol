// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSFixedPricer } from "../../price/IZNSFixedPricer.sol";
import { IZNSPausable } from "../IZNSPausable.sol";


interface IZNSFixedPricerPausable is IZNSFixedPricer, IZNSPausable {}
