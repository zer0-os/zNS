// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "./abstractions/AZNSPricing.sol";
import { AZNSPayment } from "./abstractions/AZNSPayment.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


// TODO sub: do we need this as a separate interface ??
interface IDistributionConfig {

    enum AccessType {
        LOCKED,
        OPEN,
        WHITELIST
    }

    enum PaymentType {
        DIRECT,
        STAKE
    }

    struct PaymentConfig {
        PaymentType paymentType;
        IERC20 paymentToken;
        // feeBeneficiary if STAKE, paymentBeneficiary if DIRECT
        address beneficiary;
    }

    struct DistributionConfig {
        AZNSPricing pricingContract;
        PaymentConfig paymentConfig;
        AccessType accessType;
    }
}
