// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ZNSDomainToken } from "../../token/ZNSDomainToken.sol";
import { Mock } from "../Mock.sol";

 /* solhint-disable */
contract ZNSDomainTokenMock is ZNSDomainToken, Mock {}
