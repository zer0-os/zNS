// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSTreasury {

  /**
   * @notice Emitted when the znsRegistrar is updated
   * @param znsRegistrar The address of the new registrar
   */
  event ZNSRegistrarSet(address znsRegistrar);

  /**
   * @notice Emitted when a new stake is deposited
   * @param domainHash The hash of the domain name
   * @param domainName The domain name
   * @param depositor The address of the depositing user
   * @param amount The amount they are depositing
   */
  event StakeDeposited(
    bytes32 indexed domainHash,
    string domainName,
    address indexed depositor,
    uint256 indexed amount
  );

  /**
   * @notice Emitted when a stake is withdrawn
   * @param domainHash The hash of the domain name
   * @param owner The owner of the domain
   * @param amount The amount withdrawn
   */
  event StakeWithdrawn(
    bytes32 indexed domainHash,
    address indexed owner,
    uint256 indexed amount
  );

  /**
   * @notice Emitted when the admin user is set
   * @param user The admin user to set
   */
  event AdminSet(
    address user,
    bool status
  );

  event ZeroVaultAddressSet(address zeroVault);

  function stakeForDomain(
    bytes32 domainHash,
    string calldata domainName,
    address depositor,
    bool isTopLevelDomain
  ) external;

  function unstakeForDomain(bytes32 domainHash, address owner) external;

  function setZNSRegistrar(address znsRegistrar_) external;

  function setZeroVaultAddress(address zeroVaultAddress) external;

  function setAdmin(address user, bool status) external;

  function isAdmin(address user) external view returns (bool);
}
