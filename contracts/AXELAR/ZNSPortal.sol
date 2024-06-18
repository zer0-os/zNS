pragma solidity 0.8.18;

import { AxelarExecutable } from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
import { IAxelarGasService } from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";
import { IERC20 } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IERC20.sol';


contract ZNSPortal is AxelarExecutable {
    error ZeroAddress();
    error GasPaymentRequired();

    IAxelarGasService public immutable gasService;

    constructor(
        address _gateway,
        address _gasService
    ) AxelarExecutable(_gateway) {
        if (_gasService == address(0)) revert ZeroAddress();
        gasService = IAxelarGasService(_gasService);
    }

    function sendPayload(
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload
    ) external payable {
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

    function sendPayloadWithToken(
        string memory destinationChain,
        string memory destinationAddress,
        bytes memory payload,
        string memory symbol,
        uint256 amount
    ) external payable {
        if (msg.value == 0) revert GasPaymentRequired();

        address tokenAddress = gateway.tokenAddresses(symbol);
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        IERC20(tokenAddress).approve(address(gateway), amount);
        gasService.payNativeGasForContractCallWithToken{ value: msg.value }(
            address(this),
            destinationChain,
            destinationAddress,
            payload,
            symbol,
            amount,
            msg.sender
        );

        gateway.callContractWithToken(destinationChain, destinationAddress, payload, symbol, amount);
    }
}
