// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSPricing } from "./abstractions/IZNSPricing.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IDistributionConfig {

    enum AccessType {
        LOCKED,
        OPEN,
        MINTLIST
    }

    enum PaymentType {
        DIRECT,
        STAKE
    }

    struct DistributionConfig {
        IZNSPricing pricingContract;
        PaymentType paymentType;
        AccessType accessType;
    }
}
