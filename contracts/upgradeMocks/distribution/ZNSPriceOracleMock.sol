// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSPriceOracle } from "../../distribution/ZNSPriceOracle.sol";
import { Mock } from "../Mock.sol";


contract ZNSPriceOracleMock is ZNSPriceOracle, Mock {}
