// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSEthRegistrar } from "../../distribution/ZNSEthRegistrar.sol";
import { Mock } from "../Mock.sol";

 /* solhint-disable */
contract ZNSEthRegistrarMock is ZNSEthRegistrar, Mock {}
