// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ZNSStringResolver } from "../../../resolver/ZNSStringResolver.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

/* solhint-disable-next-line */
contract ZNSStringResolverUpgradeMock is ZNSStringResolver, UpgradeMock {}
