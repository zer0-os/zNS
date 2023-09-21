// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSPricer } from "./abstractions/IZNSPricer.sol";
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
        IZNSPricer pricerContract;
        PaymentType paymentType;
        AccessType accessType;
    }
}
