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
}
