// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSSubRegistrarBranch } from "./IZNSSubRegistrarBranch.sol";
import { ZNSSubRegistrarTrunk } from "./ZNSSubRegistrarTrunk.sol";
import { IZNSSubRegistrarTrunk } from "./IZNSSubRegistrarTrunk.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";


contract ZNSSubRegistrarBranch is ZNSSubRegistrarTrunk, IZNSSubRegistrarBranch {
    function registerBridgedSubdomain(
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI
    ) external override returns (bytes32) {
        accessController.checkPortal(msg.sender);

        DistributionConfig memory emptyDistrConfig;
        PaymentConfig memory emptyPaymentConfig;

        return _coreSubdomainRegister(
            parentHash,
            label,
            address(0),
            tokenURI,
            emptyDistrConfig,
            emptyPaymentConfig,
            true
        );
    }

    function setRegistry(address registry) public override(
    ZNSSubRegistrarTrunk,
    IZNSSubRegistrarTrunk
    ) onlyAdmin {
        super.setRegistry(registry);
    }
}
