// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPayment } from "../abstractions/AZNSPayment.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract ZNSDirectPayment is AZNSPayment {
    using SafeERC20 for IERC20;

    event PaymentTokenChanged(bytes32 indexed domainHash, address newPaymentToken);
    event PaymentBeneficiaryChanged(bytes32 indexed domainHash, address newBeneficiary);

    struct PaymentConfig {
        IERC20 paymentToken;
        address beneficiary;
    }

    mapping(bytes32 domainHash => PaymentConfig config) internal paymentConfigs;

    // TODO sub: add events !!
    function processPayment(
        bytes32 parentHash,
        bytes32 domainHash,
        address depositor,
        uint256 amount
    ) external override {
        PaymentConfig memory config = paymentConfigs[parentHash];

        // setting paymentToken to 0x0 address means free domains
        // to save on tx costs, we avoid transfering 0
        if (address(config.paymentToken) != address(0)) {
            config.paymentToken.safeTransferFrom(
                depositor,
                config.beneficiary,
                amount
            );
        }
    }

    function getPaymentConfig(bytes32 domainHash) external view returns (PaymentConfig memory) {
        return paymentConfigs[domainHash];
    }

    // TODO sub: 1. access control
    // TODO sub: 2. is this the best way?
    function setPaymentConfig(bytes32 domainHash, PaymentConfig memory configToSet) external {
        setPaymentToken(domainHash, configToSet.paymentToken);
        setPaymentBeneficiary(domainHash, configToSet.beneficiary);
    }

    // TODO sub: what about types here? should we do address instead?
    function setPaymentToken(bytes32 domainHash, IERC20 paymentToken) public {
        paymentConfigs[domainHash].paymentToken = paymentToken;

        emit PaymentTokenChanged(domainHash, address(paymentToken));
    }

    function setPaymentBeneficiary(bytes32 domainHash, address beneficiary) public {
        require(beneficiary != address(0), "ZNSDirectPayment: beneficiary cannot be 0x0 address");
        paymentConfigs[domainHash].beneficiary = beneficiary;

        emit PaymentBeneficiaryChanged(domainHash, beneficiary);
    }
}
