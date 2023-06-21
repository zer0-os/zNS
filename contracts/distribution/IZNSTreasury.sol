// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSTreasury {
    /**
     * @notice Emitted when a new stake is deposited
     * @param domainHash The hash of the domain name
     * @param domainName The domain name
     * @param depositor The address of the depositing user
     * @param stakeAmount The amount they are depositing
     */
    event StakeDeposited(
        bytes32 indexed domainHash,
        string domainName,
        address indexed depositor,
        uint256 indexed stakeAmount,
        uint256 registrationFee
    );

    /**
     * @notice Emitted when a stake is withdrawn
     * @param domainHash The hash of the domain name
     * @param owner The owner of the domain
     * @param stakeAmount The staked amount withdrawn
     */
    event StakeWithdrawn(
        bytes32 indexed domainHash,
        address indexed owner,
        uint256 indexed stakeAmount
    );

    event PriceOracleSet(address priceOracle);

    event StakingTokenSet(address stakingToken);

    event ZeroVaultAddressSet(address zeroVault);

    function stakeForDomain(
        bytes32 domainHash,
        string calldata domainName,
        address depositor
    ) external;

    function unstakeForDomain(bytes32 domainHash, address owner) external;

    function setZeroVaultAddress(address zeroVaultAddress) external;

    function setPriceOracle(address priceOracle_) external;

    function setStakingToken(address stakingToken_) external;

    function setAccessController(address accessController) external;

    function getAccessController() external view returns (address);

    function initialize(
        address accessController_,
        address priceOracle_,
        address stakingToken_,
        address zeroVault_
    ) external;
}
