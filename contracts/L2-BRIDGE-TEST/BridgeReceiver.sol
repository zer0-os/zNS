// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IBridgeMessageReceiver } from "zkevm-contracts/contracts/interfaces/IBridgeMessageReceiver.sol";
import { IPolygonZkEVMBridgeV2Ext } from "./IPolygonZkEVMBridgeV2Ext.sol";
import { ZeroAddressPassed } from "../utils/CommonErrors.sol";


contract BridgeReceiver is IBridgeMessageReceiver {
    event MessageReceived(
        address originAddress,
        uint32 originNetwork,
        string message
    );

    error NotPolygonZkEVMBridge();

    // Global Exit Root address
    IPolygonZkEVMBridgeV2Ext public immutable polygonZkEVMBridge;

    // Current network identifier
    uint32 public immutable networkID;

    string public messageState;

    address public senderContract;

    constructor(IPolygonZkEVMBridgeV2Ext bridgeAddress) {
        if (address(bridgeAddress) == address(0)) revert ZeroAddressPassed();
        polygonZkEVMBridge = bridgeAddress;
        networkID = polygonZkEVMBridge.networkID();
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external payable override {
        // Can only be called by the bridge
        // Can only be called by the sender on the other network
        // require(
        //    pingSender == originAddress,
        //    "PingReceiver::onMessageReceived: Not ping Sender"
        // );

        string memory message = abi.decode(data, (string));
        messageState = message;
        senderContract = originAddress;

        emit MessageReceived(originAddress, originNetwork, message);
    }
}
