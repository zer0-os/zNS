// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSCurvePricer } from "../../price/IZNSCurvePricer.sol";
import { IZNSPausable } from "../IZNSPausable.sol";


interface IZNSCurvePricerPausable is IZNSCurvePricer, IZNSPausable {}
