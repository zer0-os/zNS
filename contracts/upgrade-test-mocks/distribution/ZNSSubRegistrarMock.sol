// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSSubRegistrar } from "../../registrar/ZNSSubRegistrar.sol";
import { UpgradeMock } from "../UpgradeMock.sol";


// solhint-disable-next-line no-empty-blocks
contract ZNSSubRegistrarUpgradeMock is ZNSSubRegistrar, UpgradeMock {}
