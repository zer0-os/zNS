// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IBridgeMessageReceiver } from "zkevm-contracts/contracts/interfaces/IBridgeMessageReceiver.sol";
import { ZeroAddressPassed } from "../utils/CommonErrors.sol";


contract BridgeReceiver is IBridgeMessageReceiver {
    event MessageReceived(
        address originAddress,
        uint32 originNetwork,
        string message
    );

    error NotPolygonZkEVMBridge();

    // Global Exit Root address
    IPolygonZkEVMBridge public immutable polygonZkEVMBridge;

    // Current network identifier
    uint32 public immutable networkID;

    string public messageState;

    address public senderContract;

    constructor(IPolygonZkEVMBridge bridgeAddress) {
        if (address(bridgeAddress) == address(0)) revert ZeroAddressPassed();
        polygonZkEVMBridge = bridgeAddress;
        networkID = polygonZkEVMBridge.networkID();
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external override {
        // Can only be called by the bridge
        if (msg.sender == address(polygonZkEVMBridge))
            revert NotPolygonZkEVMBridge();

        // Can only be called by the sender on the other network
        // require(
        //    pingSender == originAddress,
        //    "PingReceiver::onMessageReceived: Not ping Sender"
        // );

        string memory message = abi.decode(data, (string));

        emit MessageReceived(originAddress, originNetwork, message);
    }
}
