pragma solidity 0.8.18;

import { AxelarExecutable } from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
import { IAxelarGateway } from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol";
import { IAxelarGasService } from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";


contract SenderReceiver is AxelarExecutable {
    IAxelarGasService public immutable gasService;
    string public message;
    uint256 public status;

    constructor(address _gateway, address _gasService) AxelarExecutable(_gateway) {
        gasService = IAxelarGasService(_gasService);
    }

    function sendMessage(
        string calldata destinationChain,
        string calldata destinationAddress,
        string calldata message_
    ) external payable {
        bytes memory payload = abi.encode(1, message_);

        gasService.payNativeGasForContractCall{ value: msg.value } (
            address(this),
            destinationChain,
            destinationAddress,
            payload,
            msg.sender
        );

        gateway.callContract(
            destinationChain,
            destinationAddress,
            payload
        );
    }

    function sendStatus(
        string calldata destinationChain,
        string calldata destinationAddress,
        uint256 status_
    ) external payable {
        bytes memory payload = abi.encode(2, status_);

        gasService.payNativeGasForContractCall{ value: msg.value } (
            address(this),
            destinationChain,
            destinationAddress,
            payload,
            msg.sender
        );

        gateway.callContract(
            destinationChain,
            destinationAddress,
            payload
        );
    }

    function setMessage(string calldata message_) external {
        message = message_;
    }

    function setStatus(uint256 status_) external {
        status = status_;
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        uint256 method;
        (method) = abi.decode(payload, (uint256));

        if (method == 1) {
            (, message) = abi.decode(payload, (uint256, string));
        } else if (method == 2) {
            (, status) = abi.decode(payload, (uint256, uint256));
        }
    }
}
