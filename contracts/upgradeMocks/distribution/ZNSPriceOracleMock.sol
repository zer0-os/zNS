// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSPriceOracle } from "../../distribution/ZNSPriceOracle.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSPriceOracleUpgradeMock is ZNSPriceOracle, UpgradeMock {}
