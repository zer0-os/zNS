// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSAddressResolver } from "../../resolver/ZNSAddressResolver.sol";
import { Mock } from "../Mock.sol";

 /* solhint-disable */
contract ZNSAddressResolverMock is ZNSAddressResolver, Mock{}
