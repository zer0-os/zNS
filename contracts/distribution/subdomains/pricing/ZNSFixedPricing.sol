// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPricing } from "../abstractions/AZNSPricing.sol";
import { IZNSRegistry } from "../../../registry/IZNSRegistry.sol";
import { AAccessControlled } from "../../../access/AAccessControlled.sol";
import { ARegistryWired } from "../../../abstractions/ARegistryWired.sol";


contract ZNSFixedPricing is AAccessControlled, ARegistryWired, AZNSPricing {

    event PriceChanged(bytes32 indexed parentHash, uint256 newPrice);

    // TODO sub: do we need to add fees here ??
    //  what is this is used with the stake payment ??
    mapping(bytes32 domainHash => uint256 price) internal prices;

    constructor(address _accessController, address _registry) {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    function setPrice(bytes32 domainHash, uint256 _price) external onlyOwnerOrOperator(domainHash) {
        prices[domainHash] = _price;

        emit PriceChanged(domainHash, _price);
    }

    function getPrice(bytes32 parentHash, string calldata label) external override view returns (uint256) {
        return prices[parentHash];
    }

    // TODO sub: is this a viable solution to not pay for subdomains
    //  of a revoked parent ?? this lets us wipe the price at any time for the parent
    function revokePrice(bytes32 domainHash) external override onlyRegistrar {
        prices[domainHash] = 0;
        emit PriceRevoked(domainHash);
    }

    function setRegistry(address registry_) public override onlyAdmin {
        _setRegistry(registry_);
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
