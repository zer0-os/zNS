//// SPDX-License-Identifier: MIT
//pragma solidity 0.8.26;
//
//import { IPolygonZkEVMBridgeV2 } from "@zero-tech/zkevm-contracts/contracts/v2/interfaces/IPolygonZkEVMBridgeV2.sol";
//import { ZeroAddressPassed } from "../utils/CommonErrors.sol";
//
//
//contract BridgeSender {
//
//    event MessageBridged(
//        uint32 destinationNetwork,
//        address destinationAddress,
//        string message
//    );
//
//    // Global Exit Root address
//    IPolygonZkEVMBridgeV2 public immutable polygonZkEVMBridge;
//
//    constructor(IPolygonZkEVMBridgeV2 bridgeAddress) {
//        if (address(bridgeAddress) == address(0)) revert ZeroAddressPassed();
//        polygonZkEVMBridge = bridgeAddress;
//    }
//
//    function bridgeMessage(
//        uint32 destinationNetwork,
//        address destinationAddress,
//        bool forceUpdateGlobalExitRoot,
//        string memory message
//    ) external {
//        bytes memory encodedMsg = abi.encode(message);
//
//        polygonZkEVMBridge.bridgeMessage(
//            destinationNetwork,
//            destinationAddress,
//            forceUpdateGlobalExitRoot,
//            encodedMsg
//        );
//
//        emit MessageBridged(destinationNetwork, destinationAddress, message);
//    }
//}
