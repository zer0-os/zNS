// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSSubRegistrarTrunk } from "./IZNSSubRegistrarTrunk.sol";


interface IZNSSubRegistrarBranch is IZNSSubRegistrarTrunk {
    function registerBridgedSubdomain(
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI
    ) external returns (bytes32);
}
