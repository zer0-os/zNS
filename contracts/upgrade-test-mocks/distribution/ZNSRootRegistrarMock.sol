// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ZNSRootRegistrarTrunk } from "../../registrar/ZNSRootRegistrarTrunk.sol";
import { UpgradeMock } from "../UpgradeMock.sol";


contract ZNSRootRegistrarUpgradeMock is ZNSRootRegistrarTrunk, UpgradeMock {
}
