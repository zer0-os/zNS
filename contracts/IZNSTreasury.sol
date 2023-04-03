// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSTreasury {

    event ZNSRegistrarSet(address znsRegistrar);
    // TODO: do we actually need "domainName" in all these events??
    event StakeDeposited(
        bytes32 indexed domainHash,
        string domainName,
        address indexed depositor,
        uint256 indexed amount
    );
    event StakeWithdrawn(
        bytes32 indexed domainHash,
        address indexed owner,
        uint256 indexed amount
    );

    function stakeForDomain(
        bytes32 domainHash,
        string name,
        address depositor,
        bool useFee
    ) external;

    function unstakeForDomain(bytes32 domainHash, address owner) external;

    function getStakedAmountForDomain(bytes32 domainHash) public returns (uint256);

    function setZnsRegistrar(address _znsRegistrar) external;

    function getZnsRegistrar() external returns (address);
}
