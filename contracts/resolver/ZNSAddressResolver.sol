// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IZNSAddressResolver } from "./IZNSAddressResolver.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";

contract ZNSAddressResolver is ERC165, IZNSAddressResolver {
    /**
     * @notice Address of the ZNSRegistry contract that holds all crucial data
     *         for every domain in the system
     */
    IZNSRegistry public registry;

    /**
     * @notice Mapping of domain hash to address used to bind domains
     *         to Ethereum wallets or contracts registered in ZNS
     */
    mapping(bytes32 domainHash => address resolvedAddress)
        private addressOf;

    constructor(IZNSRegistry _registry) {
        registry = _registry;
    }

    /**
     * @dev Revert if `msg.sender` is not the owner or an operator allowed by the owner
     * @param domainHash The identifying hash of a domain's name
     */
    modifier onlyOwnerOrOperator(bytes32 domainHash) {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSAddressResolver: Not authorized for this domain"
        );
        _;
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
    ) external override onlyOwnerOrOperator(domainHash) {
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
    ) public view virtual override(ERC165, IZNSAddressResolver) returns (bool) {
        return
            interfaceId == getInterfaceId() ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev Exposes IZNSAddressResolver interfaceId
     */
    function getInterfaceId() public pure override returns (bytes4) {
          return type(IZNSAddressResolver).interfaceId;
    }
}
