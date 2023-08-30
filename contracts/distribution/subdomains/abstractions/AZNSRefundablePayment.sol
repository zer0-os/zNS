// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPayment } from "./AZNSPayment.sol";


abstract contract AZNSRefundablePayment is AZNSPayment {
    event RefundProcessed(
        bytes32 indexed parentHash,
        bytes32 indexed domainHash,
        address indexed domainOwner,
        uint256 amount
    );

    function refundsOnRevoke() external pure override returns (bool) {
        return true;
    }

    function refund(
        bytes32 parentHash,
        bytes32 domainHash,
        address domainOwner
    ) external virtual;
}
