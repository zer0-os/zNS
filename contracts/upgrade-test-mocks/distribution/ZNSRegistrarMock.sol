// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSRegistrar } from "../../distribution/ZNSRegistrar.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSRegistrarUpgradeMock is ZNSRegistrar, UpgradeMock {}
