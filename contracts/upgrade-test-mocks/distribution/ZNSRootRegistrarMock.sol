// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { ZNSRootRegistrar } from "../../registrar/ZNSRootRegistrar.sol";
import { UpgradeMock } from "../UpgradeMock.sol";

 /* solhint-disable */
contract ZNSRootRegistrarUpgradeMock is ZNSRootRegistrar, UpgradeMock {
    constructor(
        address accessController_,
        address registry_,
        address rootPricer_,
        address treasury_,
        address domainToken_,
        address gateway_
    ) ZNSRootRegistrar(accessController_, registry_, rootPricer_, treasury_, domainToken_, gateway_) {}
}
