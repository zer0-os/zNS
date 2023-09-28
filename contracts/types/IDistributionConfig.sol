// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IDistributionConfig.sol
 * @notice Definition of a distrubution configuration for any given domain as 
 * well as the enums `AccessType` and `PaymentType` which indicate who use able
 * to mint new domains based on the configuration of this domain as well as how
 * they will pay for it.
 */
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
