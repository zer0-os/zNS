// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


// TODO sub: add ERC-165 inteface checking? how to validate that a contract inherited this?
// TODO sub fee: possibly remove this !
abstract contract AZNSPayment {

    event PaymentTokenChanged(bytes32 indexed domainHash, address newPaymentToken);
    event PaymentBeneficiaryChanged(bytes32 indexed domainHash, address newBeneficiary);
    event PaymentProcessed(
        bytes32 indexed parentHash,
        bytes32 indexed domainHash,
        address indexed payer,
        uint256 amount,
        uint256 fee
    );

    struct PaymentConfig {
        IERC20 paymentToken;
        address beneficiary;
    }

    mapping(bytes32 domainHash => PaymentConfig config) public paymentConfigs;

    // TODO sub: should we add setters and getters here? mb just virtual ??

    function processPayment(
        bytes32 parentHash,
        bytes32 domainHash,
        address payer,
        uint256 amount,
        uint256 stakeFee
    ) external virtual;

    function refundsOnRevoke() external pure virtual returns (bool) {
        return false;
    }
}
