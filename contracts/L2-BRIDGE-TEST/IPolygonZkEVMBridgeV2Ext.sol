// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.20;

import { IPolygonZkEVMBridgeV2 } from "zkevm-contracts/contracts/v2/interfaces/IPolygonZkEVMBridgeV2.sol";


interface IPolygonZkEVMBridgeV2Ext is IPolygonZkEVMBridgeV2 {
    function networkID() external view returns (uint32);
}
