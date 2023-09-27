// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSAddressResolver {
    /**
     * @dev Emit when ownership of a domain is modified
     * @param newAddress The new domain owner
     * @param domainHash The identifying hash of a domain's name
     */
    event AddressSet(bytes32 indexed domainHash, address indexed newAddress);

    /**
     * @dev ERC-165 check for implementation identifier
     * @dev Supports interfaces IZNSAddressResolver and IERC165
     * @param interfaceId ID to check, XOR of the first 4 bytes of each function signature
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    /**
     * @dev Resolves address given domain name hash
     * @param domainHash The identifying hash of a domain's name
     */
    function getAddress(bytes32 domainHash) external view returns (address);

    /**
     * @dev Sets the address of a domain name hash, only registry
     * @param domainHash The identifying hash of a domain's name
     * @param newAddress The new domain owner
     */
    function setAddress(
        bytes32 domainHash,
        address newAddress
    ) external;

    function getInterfaceId() external pure returns (bytes4);

    /**
     * @notice Initialize an instance of the ZNSAddressResolver
     * @param _accessController The access controller
     * @param _registry The registry address
     */
    function initialize(address _accessController, address _registry) external;
}
