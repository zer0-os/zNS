// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSRootRegistrarBase } from "./IZNSRootRegistrarBase.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";


interface IZNSRootRegistrarTrunk is IZNSRootRegistrarBase {
    function registerRootDomain(
        string calldata name,
        address domainAddress,
        string calldata tokenURI,
        DistributionConfig calldata distributionConfig,
        PaymentConfig calldata paymentConfig
    ) external returns (bytes32);
}
