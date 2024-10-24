// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


interface IZNSChainResolver {
    event ChainDataSet(
        bytes32 indexed domainHash,
        uint256 chainID,
        string chainName,
        address znsRegistryOnChain,
        string auxData
    );

    struct ChainData {
        uint256 chainId;
        string chainName;
        address znsRegistryOnChain;
        string auxData;
    }

    function initialize(address accessController_, address registry_) external;

    function resolveChainData(
        bytes32 domainHash
    ) external view returns (uint256, string memory, address, string memory);

    function resolveChainDataStruct(
        bytes32 domainHash
    ) external view returns (ChainData memory);

    function setChainData(
        bytes32 domainHash,
        uint256 chainID,
        string memory chainName,
        address znsRegistryOnChain,
        string memory auxData
    ) external;

    function supportsInterface(
        bytes4 interfaceId
    ) external view returns (bool);

    function getInterfaceId() external pure returns (bytes4);

    function setRegistry(address _registry) external;
}
