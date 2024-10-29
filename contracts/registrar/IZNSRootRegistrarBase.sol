// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSSubRegistrar } from "./IZNSSubRegistrar.sol";
import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IZNSTreasury } from "../treasury/IZNSTreasury.sol";
import { IZNSRootRegistrarTypes } from "./IZNSRootRegistrarTypes.sol";
import { CoreRegisterArgs } from "./IZNSRootRegistrarTypes.sol";


// TODO multi: fix NatSpec here!!!
/**
 * @title IZNSRootRegistrar.sol - Interface for the ZNSRootRegistrar contract resposible for registering root domains.
 * @notice Below are docs for the types in this file:
 *  - `OwnerOf`: Enum signifying ownership of ZNS entities
 *      + NAME: The owner of the Name only
 *      + TOKEN: The owner of the Token only
 *      + BOTH: The owner of both the Name and the Token
 *  - `CoreRegisterArgs`: Struct containing all the arguments required to register a domain
 *  with ZNSRootRegistrar.coreRegister():
 *      + `parentHash`: The hash of the parent domain (0x0 for root domains)
 *      + `domainHash`: The hash of the domain to be registered
 *      + `label`: The label of the domain to be registered
 *      + `registrant`: The address of the user who is registering the domain
 *      + `price`: The determined price for the domain to be registered based on parent rules
 *      + `stakeFee`: The determined stake fee for the domain to be registered (only for PaymentType.STAKE!)
 *      + `domainAddress`: The address to which the domain will be resolved to
 *      + `tokenURI`: The tokenURI for the domain to be registered
 *      + `isStakePayment`: A flag for whether the payment is a stake payment or not
 */
interface IZNSRootRegistrarBase is IZNSRootRegistrarTypes {
    function initialize(
        address accessController_,
        address registry_,
        address rootPricer_,
        address treasury_,
        address domainToken_
    ) external;

    function coreRegister(
        CoreRegisterArgs memory args
    ) external;

    function revokeDomain(bytes32 domainHash) external;

    function reclaimDomain(bytes32 domainHash) external;

    function isOwnerOf(bytes32 domainHash, address candidate, OwnerOf ownerOf) external view returns (bool);

    function setRegistry(address registry_) external;

    function setRootPricer(address rootPricer_) external;

    function setTreasury(address treasury_) external;

    function setDomainToken(address domainToken_) external;

    function setSubRegistrar(address subRegistrar_) external;

    function rootPricer() external view returns (IZNSPricer);

    function treasury() external view returns (IZNSTreasury);

    function domainToken() external view returns (IZNSDomainToken);

    function subRegistrar() external view returns (IZNSSubRegistrar);
}
