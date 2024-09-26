// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSStringResolver } from "./IZNSStringResolver.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { NotAuthorizedForDomain } from "../utils/CommonErrors.sol";
import { IZNSChainResolver } from "./IZNSChainResolver.sol";


contract ZNSChainResolver is
    UUPSUpgradeable,
    AAccessControlled,
    ARegistryWired,
    ERC165,
    IZNSChainResolver {

    mapping(bytes32 => ChainData) internal chainData;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address accessController_, address registry_) external override initializer {
        _setAccessController(accessController_);
        setRegistry(registry_);
    }

    function resolveChainData(
        bytes32 domainHash
    ) external view override returns (uint32, string memory, address, string memory) {
        ChainData memory data = chainData[domainHash];
        return (data.chainId, data.chainName, data.znsRegistryOnChain, data.auxData);
    }

    function resolveChainDataStruct(
        bytes32 domainHash
    ) external view override returns (ChainData memory) {
        return chainData[domainHash];
    }

    function setChainData(
        bytes32 domainHash,
        uint32 chainID,
        string memory chainName,
        address znsRegistryOnChain,
        string memory auxData
    ) external override {
        if (
            !registry.isOwnerOrOperator(domainHash, msg.sender)
        ) revert NotAuthorizedForDomain(msg.sender, domainHash);

        chainData[domainHash] = ChainData(
            chainID,
            chainName,
            znsRegistryOnChain,
            auxData
        );

        emit ChainDataSet(
            domainHash,
            chainID,
            chainName,
            znsRegistryOnChain,
            auxData
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165, IZNSChainResolver) returns (bool) {
        return
            interfaceId == getInterfaceId() ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev Exposes IZNSAddressResolver interfaceId
     */
    function getInterfaceId() public pure override returns (bytes4) {
        return type(IZNSChainResolver).interfaceId;
    }

    function setRegistry(address _registry) public override(ARegistryWired, IZNSChainResolver) onlyAdmin {
        _setRegistry(_registry);
    }

    // solhint-disable-next-line no-unused-vars
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
