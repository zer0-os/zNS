// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { ZNSRootRegistrarBase } from "./ZNSRootRegistrarBase.sol";
import { IZNSRootRegistrarBranch } from "./IZNSRootRegistrarBranch.sol";
import { IZNSRootRegistrarBase } from "./IZNSRootRegistrarBase.sol";
import { CoreRegisterArgs } from "./IZNSRootRegistrarTypes.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { ZeroAddressPassed, DomainAlreadyExists } from "../utils/CommonErrors.sol";


// TODO multi: fix NatSpec here !
/**
 * @title Main entry point for the three main flows of ZNS - Register Root Domain, Reclaim and Revoke any domain.
 * @notice This contract serves as the "umbrella" for many ZNS operations, it is given REGISTRAR_ROLE
 * to combine multiple calls/operations between different modules to achieve atomic state changes
 * and proper logic for the ZNS flows. You can see functions in other modules that are only allowed
 * to be called by this contract to ensure proper management of ZNS data in multiple places.
 * RRR - Register, Reclaim, Revoke start here and then call other modules to complete the flow.
 * ZNSRootRegistrar.sol stores most of the other contract addresses and can communicate with other modules,
 * but the relationship is one-sided, where other modules do not need to know about the ZNSRootRegistrar.sol,
 * they only check REGISTRAR_ROLE that can, in theory, be assigned to any other address.
 * @dev This contract is also called at the last stage of registering subdomains, since it has the common
 * logic required to be performed for any level domains.
 */
contract ZNSRootRegistrarBranch is
// TODO multi: fix inheritance on all child contracts! it is not needed!!!
    UUPSUpgradeable,
    AAccessControlled,
    ARegistryWired,
    ZNSRootRegistrarBase,
    IZNSRootRegistrarBranch {

    // TODO multi: add NatSpec here !!!
    function registerBridgedRootDomain(
        string calldata label,
        string calldata tokenURI
    ) external returns (bytes32) {
        accessController.checkPortal(msg.sender);

        DistributionConfig memory emptyDistrConfig;
        PaymentConfig memory emptyPaymentConfig;

        return _coreRootRegister(
            label,
            address(0),
            tokenURI,
            emptyDistrConfig,
            emptyPaymentConfig,
            true
        );
    }

    function setRegistry(address registry) public override(
        ARegistryWired,
        ZNSRootRegistrarBase,
        IZNSRootRegistrarBase
    ) onlyAdmin {
        super.setRegistry(registry);
    }
}
