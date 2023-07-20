// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPayment } from "../interfaces/AZNSPayment.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract ZNSDirectPayment is AZNSPayment {

    event PaymentTokenChanged(bytes32 indexed domainHash, address newPaymentToken);
    event PaymentBeneficiaryChanged(bytes32 indexed domainHash, address newBeneficiary);

    struct PaymentConfig {
        IERC20 paymentToken;
        address beneficiary;
    }

    mapping(bytes32 domainHash => PaymentConfig config) internal paymentConfigs;

    function processPayment(bytes32 domainHash, address depositor) external override view override {
        PaymentConfig memory config = paymentConfigs[domainHash];

        // setting paymentToken to 0x0 address means free domains
        // to save on tx costs, we avoid transfering 0
        if (config.paymentToken != address(0)) {
            config.paymentToken.transferFrom(
                depositor,
                config.beneficiary,
                config.paymentToken.balanceOf(depositor)
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

    function setPaymentToken(bytes32 domainHash, address paymentToken) public {
        paymentConfigs[domainHash].paymentToken = IERC20(paymentToken);

        emit PaymentTokenChanged(domainHash, paymentToken);
    }

    function setPaymentBeneficiary(bytes32 domainHash, address beneficiary) public {
        require(beneficiary != address(0), "ZNSDirectPayment: beneficiary cannot be 0x0 address");
        paymentConfigs[domainHash].beneficiary = beneficiary;

        emit PaymentBeneficiaryChanged(domainHash, beneficiary);
    }
}
