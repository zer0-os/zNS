// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ZNSAddressResolver } from "../../../resolver/ZNSAddressResolver.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSAddressResolverUpgradeMock is ZNSAddressResolver, UpgradeMock{}
