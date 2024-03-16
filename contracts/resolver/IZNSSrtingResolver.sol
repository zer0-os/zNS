// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;


interface IZNSStringResolver {
    /**
     * @param newString The new domain owner
     * @param domainHash The identifying hash of a domain's name
     */
    event StringSet(bytes32 indexed domainHash, string indexed newString);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function resolveDomainString(bytes32 domainHash) external view returns (string memory);

    function setString(
        bytes32 domainHash,
        string calldata newString
    ) external;

    function getInterfaceId() external pure returns (bytes4);

    function setRegistry(address _registry) external;

    function initialize(address _accessController, address _registry) external;
}
