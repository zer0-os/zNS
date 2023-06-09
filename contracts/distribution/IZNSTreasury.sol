// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSTreasury {
    /**
     * @notice Emitted when a new stake is deposited upon registration of a new domain.
     * @param domainHash The hash of the domain name
     * @param domainName The domain name as a string
     * @param depositor The address of the depositing user / new domain owner
     * @param stakeAmount The amount they are depositing / price of the domain based on name length
     * @param registrationFee The registration fee paid by the user on top of the staked amount
     */
    event StakeDeposited(
        bytes32 indexed domainHash,
        string domainName,
        address indexed depositor,
        uint256 indexed stakeAmount,
        uint256 registrationFee
    );

    /**
     * @notice Emitted when a stake is withdrawn upon domain revocation.
     * @param domainHash The hash of the domain name being revoked
     * @param owner The owner of the domain being revoked
     * @param stakeAmount The staked amount withdrawn to the user after revoking
     */
    event StakeWithdrawn(
        bytes32 indexed domainHash,
        address indexed owner,
        uint256 indexed stakeAmount
    );

    /**
     * @notice Emitted when `priceOracle` is set in state.
     * @param priceOracle The new address of the price oracle contract
     */
    event PriceOracleSet(address priceOracle);

    /**
     * @notice Emitted when `stakingToken` is set in state.
     * @param stakingToken The new address of the ERC-20 compliant staking token contract
     */
    event StakingTokenSet(address stakingToken);

    /**
     * @notice Emitted when `zeroVault` is set in state.
     * @param zeroVault The new address of the zero vault contract or wallet
     */
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
