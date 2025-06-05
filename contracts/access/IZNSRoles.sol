// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


interface IZNSRoles {
    function ADMIN_ROLE() external view returns (bytes32);

    function GOVERNOR_ROLE() external view returns (bytes32);

    function REGISTRAR_ROLE() external view returns (bytes32);

    function DOMAIN_TOKEN_ROLE() external view returns (bytes32);

    function EXECUTOR_ROLE() external view returns (bytes32);
}