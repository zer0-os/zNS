// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSCurvePricer } from "../../distribution/ZNSCurvePricer.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSCurvePricerUpgradeMock is ZNSCurvePricer, UpgradeMock {}
