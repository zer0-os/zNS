// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IPolygonZkEVMBridgeV2 } from "@zero-tech/zkevm-contracts/contracts/v2/interfaces/IPolygonZkEVMBridgeV2.sol";


interface IPolygonZkEVMBridgeV2Ext is IPolygonZkEVMBridgeV2 {
    function networkID() external view returns (uint32);
}
