// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ZNSRegistry } from "../../../registry/ZNSRegistry.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSRegistryUpgradeMock is ZNSRegistry, UpgradeMock {}
