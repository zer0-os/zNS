// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSEthRegistrar } from "../../distribution/ZNSEthRegistrar.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSEthRegistrarUpgradeMock is ZNSEthRegistrar, UpgradeMock {}
