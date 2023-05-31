// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSAddressResolverMock } from "./IZNSAddressResolverMock.sol";
import { IZNSRegistryMock } from "../registry/IZNSRegistryMock.sol";
import { AccessControlled } from "../../access/AccessControlled.sol";


contract ZNSAddressResolverMock is AccessControlled, UUPSUpgradeable, ERC165, IZNSAddressResolverMock {
    /**
     * @notice Address of the ZNSRegistry contract that holds all crucial data
     *         for every domain in the system
     */
    IZNSRegistryMock public registry;

    /**
     * @notice Mapping of domain hash to address used to bind domains
     *         to Ethereum wallets or contracts registered in ZNS
     */
    mapping(bytes32 domainHash => address resolvedAddress)
        private addressOf;

    /**
     * @notice Initialize an instance of the ZNSAddressResolver
     * @param _accessController The access controller
     * @param _registry The registry address
     */
    function initialize(address _accessController, address _registry) public initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    /**
     * @dev Resolves address given domain name hash
     * @param domainHash The identifying hash of a domain's name
     */
    function getAddress(
        bytes32 domainHash
    ) external view override returns (address) {
        return addressOf[domainHash];
    }

    /**
     * @dev Sets the address of a domain name hash, only registry
     * @param domainHash The identifying hash of a domain's name
     * @param newAddress The new domain owner
     */
    function setAddress(
        bytes32 domainHash,
        address newAddress
    ) external override {
        // only owner or operator of the current domain can set the address
        // also, ZNSRegistrar can set the address as part of the registration process
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender) ||
            accessController.isRegistrar(msg.sender),
            "ZNSAddressResolver: Not authorized for this domain"
        );

        addressOf[domainHash] = newAddress;

        emit AddressSet(domainHash, newAddress);
    }

    /**
     * @dev ERC-165 check for implementation identifier
     * @dev Supports interfaces IZNSAddressResolver and IERC165
     * @param interfaceId ID to check, XOR of the first 4 bytes of each function signature
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165, IZNSAddressResolverMock) returns (bool) {
        return
            interfaceId == getInterfaceId() ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev Exposes IZNSAddressResolver interfaceId
     */
    function getInterfaceId() public pure override returns (bytes4) {
        return type(IZNSAddressResolverMock).interfaceId;
    }

    function setRegistry(address _registry) public override onlyAdmin {
        require(
            _registry != address(0),
            "ZNSAddressResolver: _registry is 0x0 address"
        );
        registry = IZNSRegistryMock(_registry);

        emit RegistrySet(_registry);
    }

    function setAccessController(
        address accessController
    ) external override(AccessControlled, IZNSAddressResolverMock) onlyAdmin {
        _setAccessController(accessController);
    }

    function getAccessController() external view override(AccessControlled, IZNSAddressResolverMock) returns (address) {
        return address(accessController);
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The implementation contract to upgrade to
     */
    function _authorizeUpgrade(address newImplementation) internal override {
        accessController.checkGovernor(msg.sender);
    }
}
