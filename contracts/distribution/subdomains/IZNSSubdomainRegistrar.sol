// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IDistributionConfig } from "./IDistributionConfig.sol";


interface IZNSSubdomainRegistrar is IDistributionConfig {
    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        DistributionConfig calldata configForSubdomains
    ) external;

    function hashWithParent(
        bytes32 parentHash,
        string calldata name
    ) external pure returns (bytes32);

    function setParentRules(
        bytes32 parentHash,
        DistributionConfig calldata config
    ) external;
}
