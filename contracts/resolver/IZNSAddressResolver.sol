// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSAddressResolver {
    /**
     * @dev Emit when ownership of a domain is modified
     * @param newAddress The new domain owner
     * @param domainNameHash The identifying hash of a domain's name
     */
    event AddressSet(bytes32 indexed domainNameHash, address indexed newAddress);

    /**
     * @dev ERC-165 check for implementation identifier
     * @dev Supports interfaces IZNSAddressResolver and IERC165
     * @param interfaceId ID to check, XOR of the first 4 bytes of each function signature
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    /**
     * @dev Resolves address given domain name hash
     * @param domainNameHash The identifying hash of a domain's name
     */
    function getAddress(bytes32 domainNameHash) external view returns (address);

    /**
     * @dev Sets the address of a domain name hash, only registry
     * @param domainNameHash The identifying hash of a domain's name
     * @param newAddress The new domain owner
     */
    function setAddress(
        bytes32 domainNameHash,
        address newAddress
    ) external;
}
