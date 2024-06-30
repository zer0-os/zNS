pragma solidity 0.8.18;

import { AxelarExecutable } from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
import { IAxelarGateway } from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol";
import { IAxelarGasService } from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleTest is AxelarExecutable {
    uint256 public value;

    error CallFailed(bytes callReturnValue);

    constructor(uint256 _value, address _gateway)
        AxelarExecutable(_gateway)
    {
        value = _value;
    }

    function setValue(uint256 _value) external {
        value = _value;
    }

    function receiveToken(address token, address holder, uint256 amount) public {
        IERC20(token).transferFrom(holder, address(this), amount);
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        (bool success, bytes memory returnVal) = address(this).call(payload);

        if (!success) {
            revert CallFailed(returnVal);
        }
    }
}