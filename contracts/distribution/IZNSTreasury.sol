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

  event AdminSet(
    address user
  );

  function getPriceFee(uint256 stakeAmount) external pure returns (uint256);

  function stakeForDomain(
    bytes32 domainHash,
    string calldata domainName,
    address depositor,
    address burnAddress,
    bool isTopLevelDomain
  ) external;

  function unstakeForDomain(bytes32 domainHash, address owner) external;

  function getStakedAmountForDomain(
    bytes32 domainHash
  ) external returns (uint256);

  function setZNSRegistrar(address _znsRegistrar) external;

  function getZNSRegistrar() external returns (address);
}
