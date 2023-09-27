// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSRegistry } from "./IZNSRegistry.sol";


abstract contract ARegistryWired {
    event RegistrySet(address registry);

    IZNSRegistry public registry;

    modifier onlyOwnerOrOperator(bytes32 domainHash) {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ARegistryWired: Not authorized. Only Owner or Operator allowed"
        );
        _;
    }

    function _setRegistry(address registry_) internal {
        require(registry_ != address(0), "ARegistryWired: _registry can not be 0x0 address");
        registry = IZNSRegistry(registry_);
        emit RegistrySet(registry_);
    }

    /**
     * @notice Virtual function to make sure the setter is always implemented in children,
     * otherwise we will not be able to reset the ZNSRegistry address in children
     */
    function setRegistry(address registry_) external virtual;
}
