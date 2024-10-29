// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSRootRegistrarBase } from "./IZNSRootRegistrarBase.sol";


interface IZNSRootRegistrarBranch is IZNSRootRegistrarBase {
    function registerBridgedRootDomain(
        string calldata label,
        string calldata tokenURI
    ) external returns (bytes32);
}
