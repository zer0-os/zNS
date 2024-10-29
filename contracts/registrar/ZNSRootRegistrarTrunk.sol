// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ZNSRootRegistrarBase } from "./ZNSRootRegistrarBase.sol";
import { IZNSRootRegistrarTrunk } from "./IZNSRootRegistrarTrunk.sol";
import { IZNSRootRegistrarBase } from "./IZNSRootRegistrarBase.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";


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
contract ZNSRootRegistrarTrunk is
    ZNSRootRegistrarBase,
    IZNSRootRegistrarTrunk {

    /**
     * @notice This function is the main entry point for the Register Root Domain flow.
     * Registers a new root domain such as `0://wilder`.
     * Gets domain hash as a keccak256 hash of the domain label string casted to bytes32,
     * checks existence of the domain in the registry and reverts if it exists.
     * Calls `ZNSTreasury` to do the staking part, gets `tokenId` for the new token to be minted
     * as domain hash casted to uint256, mints the token and sets the domain data in the `ZNSRegistry`
     * and, possibly, `ZNSAddressResolver`. Emits a `DomainRegistered` event.
     * @param label Name (label) of the domain to register
     * @param domainAddress (optional) Address for the `ZNSAddressResolver` to return when requested
     * @param tokenURI URI to assign to the Domain Token issued for the domain
     * @param distributionConfig (optional) Distribution config for the domain to set in the same tx
     *     > Please note that passing distribution config will add more gas to the tx and most importantly -
     *      - the distributionConfig HAS to be passed FULLY filled or all zeros. It is optional as a whole,
     *      but all the parameters inside are required.
     * @param paymentConfig (optional) Payment config for the domain to set on ZNSTreasury in the same tx
     *  > `paymentConfig` has to be fully filled or all zeros. It is optional as a whole,
     *  but all the parameters inside are required.
     */
    function registerRootDomain(
        string calldata label,
        address domainAddress,
        string calldata tokenURI,
        DistributionConfig calldata distributionConfig,
        PaymentConfig calldata paymentConfig
    ) external returns (bytes32) {
        return _coreRootRegister(
            label,
            domainAddress,
            tokenURI,
            distributionConfig,
            paymentConfig,
            false
        );
    }

    function setRegistry(address registry) public override(
        ZNSRootRegistrarBase,
        IZNSRootRegistrarBase
    ) onlyAdmin {
        super.setRegistry(registry);
    }
}
