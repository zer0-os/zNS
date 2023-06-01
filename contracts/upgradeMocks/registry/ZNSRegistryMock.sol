// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSRegistry } from "../../registry/ZNSRegistry.sol";
import { Mock } from "../Mock.sol";

 /* solhint-disable */
contract ZNSRegistryMock is ZNSRegistry, Mock {}
