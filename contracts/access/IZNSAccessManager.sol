// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IAccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";

interface IZNSAccessManager is IAccessControlUpgradeable {
    function checkRole(bytes32 role, address account) external view;
}
