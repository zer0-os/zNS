// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSTreasury {

    event ZNSRegistrarSet(address znsRegistrar);
    event StakeDeposited(
        bytes32 indexed domainHash,
        string name,
        address indexed depositor,
        uint256 indexed amount
    );

    function stakeForDomain(
        bytes32 domainHash,
        string name,
        address depositor,
        bool useFee
    ) external;

    function getStakedAmountForDomain(bytes32 domainHash) public returns (uint256);

    function setZnsRegistrar(address _znsRegistrar) external;

    function getZnsRegistrar() external returns (address);
}
