// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


interface IZNSAddressResolver {
    /**
     * @dev Emitted when address resolution value is set for a domain.
     *
     * @param newAddress The new domain owner
     * @param domainHash The identifying hash of a domain's name
     */
    event AddressSet(bytes32 indexed domainHash, address indexed newAddress);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function resolveDomainAddress(bytes32 domainHash) external view returns (address);

    function setAddress(
        bytes32 domainHash,
        address newAddress
    ) external;

    function getInterfaceId() external pure returns (bytes4);

    function setRegistry(address _registry) external;

    function initialize(address _accessController, address _registry) external;
}
