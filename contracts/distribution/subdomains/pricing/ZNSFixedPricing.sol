// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "../abstractions/AZNSPricing.sol";
import { IZNSRegistry } from "../../../registry/IZNSRegistry.sol";
import { AAccessControlled } from "../../../access/AAccessControlled.sol";


contract ZNSFixedPricing is AAccessControlled, AZNSPricing {

    event PriceChanged(bytes32 indexed parentHash, uint256 newPrice);
    event RegistrySet(address registry);

    IZNSRegistry public registry;

    mapping(bytes32 domainHash => uint256 price) internal prices;

    constructor(address _accessController, address _registry) {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    function setPrice(bytes32 domainHash, uint256 _price) external {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSFixedPricing: Not authorized"
        );

        prices[domainHash] = _price;

        emit PriceChanged(domainHash, _price);
    }

    function getPrice(bytes32 parentHash, string calldata name) external override view returns (uint256) {
        return prices[parentHash];
    }

    function setRegistry(address registry_) public onlyAdmin {
        require(registry_ != address(0), "ZNSFixedPricing: _registry can not be 0x0 address");
        registry = IZNSRegistry(registry_);

        emit RegistrySet(registry_);
    }

    function setAccessController(address accessController_)
    external
    override
    onlyAdmin {
        _setAccessController(accessController_);
    }

    function getAccessController() external view override returns (address) {
        return address(accessController);
    }
}
