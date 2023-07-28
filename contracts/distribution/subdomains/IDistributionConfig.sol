// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "./abstractions/AZNSPricing.sol";
import {AZNSPayment} from "./abstractions/AZNSPayment.sol";


// TODO sub: do we need this as a separate interface ??
interface IDistributionConfig {

    enum AccessType {
        LOCKED,
        OPEN,
        WHITELIST
    }

    struct DistributionConfig {
        AZNSPricing pricingContract;
        AZNSPayment paymentContract;
        AccessType accessType;
    }
}
