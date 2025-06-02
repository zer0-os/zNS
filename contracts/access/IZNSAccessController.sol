// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IZNSRoles } from "./IZNSRoles.sol";


interface IZNSAccessController is IAccessControl, IZNSRoles {
    function setRoleAdmin(bytes32 role, bytes32 adminRole) external;

    function checkGovernor(address account) external view;

    function checkAdmin(address account) external view;

    function checkExecutor(address account) external view;

    function checkRegistrar(address account) external view;

    function checkDomainToken(address account) external view;

    function isAdmin(address account) external view returns (bool);

    function isRegistrar(address account) external view returns (bool);

    function isDomainToken(address account) external view returns (bool);

    function isGovernor(address account) external view returns (bool);

    function isExecutor(address account) external view returns (bool);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
