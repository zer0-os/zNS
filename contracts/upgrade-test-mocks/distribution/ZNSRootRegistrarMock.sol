// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ZNSRootRegistrar } from "../../registrar/ZNSRootRegistrar.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSRootRegistrarUpgradeMock is ZNSRootRegistrar, UpgradeMock {}
