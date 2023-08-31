// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


struct PaymentConfig {
    IERC20 paymentToken;
    // feeBeneficiary if STAKE, paymentBeneficiary if DIRECT
    address beneficiary;
}


interface IZNSTreasury {
    /**
     * @notice Emitted when a new stake is deposited upon registration of a new domain.
     * @param domainHash The hash of the domain name
     * @param depositor The address of the depositing user / new domain owner
     * @param stakeAmount The amount they are depositing / price of the domain based on name length
     * @param stakeFee The registration fee paid by the user on top of the staked amount
     */
    event StakeDeposited(
        bytes32 indexed domainHash,
        address indexed depositor,
        address stakingToken,
        uint256 indexed stakeAmount,
        uint256 stakeFee,
        uint256 protocolFee
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

    event DirectPaymentProcessed(
        address indexed payer,
        address indexed beneficiary,
        uint256 indexed amount,
        uint256 protocolFee
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

    function setPaymentConfig(
        bytes32 domainHash,
        PaymentConfig memory paymentConfig
    ) external;

    function stakeForDomain(
        bytes32 parentHash,
        bytes32 domainHash,
        address depositor,
        uint256 stakeAmount,
        uint256 stakeFee,
        uint256 protocolFee
    ) external;

    function unstakeForDomain(bytes32 domainHash, address owner) external;

    function processDirectPayment(
        bytes32 parentHash,
        address payer,
        uint256 paymentAmount,
        uint256 protocolFee
    ) external;

    function stakedForDomain(bytes32 domainHash) external view returns (uint256);

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
