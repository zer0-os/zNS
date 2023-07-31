// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


// TODO sub: add ERC-165 inteface checking? how to validate that a contract inherited this?
abstract contract AZNSPayment {
    // TODO sub: do we add pricing contract price here or call it from Registrar?

    // TODO sub: how do we override payable with nonpayable? should we implement both?
    //  do we need 2 interfaces for ETH and ERC?
    function processPayment(
        bytes32 parentHash,
        bytes32 domainHash,
        address depositor,
        uint256 amount,
        uint256 fee
    ) external virtual;

    function refundsOnRevoke() external pure virtual returns (bool) {
        return false;
    }

    // TODO sub: should we add checks for msg.value so people don't lose ETH
    //  if they made a mistake and sent it instead of ERC20?
}
