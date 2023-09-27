// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


struct PaymentConfig {
    IERC20 token;
    // feeBeneficiary if STAKE, paymentBeneficiary if DIRECT
    address beneficiary;
}


interface IZNSTreasury {

    struct Stake {
        IERC20 token;
        uint256 amount;
    }

    /**
     * @notice Emitted when a new stake is deposited upon registration of a new domain.
     * @param domainHash The hash of the domain name
     * @param depositor The address of the depositing user / new domain owner
     * @param stakeAmount The amount they are depositing / price of the domain based on name length
     * @param stakeFee The registration fee paid by the user on top of the staked amount
     */
    event StakeDeposited(
        bytes32 indexed parentHash,
        bytes32 indexed domainHash,
        address indexed depositor,
        address stakingToken,
        uint256 stakeAmount,
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
        address indexed stakingToken,
        uint256 stakeAmount
    );

    event DirectPaymentProcessed(
        bytes32 indexed parentHash,
        bytes32 indexed domainHash,
        address indexed payer,
        address beneficiary,
        uint256 amount,
        uint256 protocolFee
    );

    /**
     * @notice Emitted when `curvePricer` is set in state.
     * @param curvePricer The new address of the CurvePricer contract
     */
    event CurvePricerSet(address curvePricer);

    /**
     * @notice Emitted when `stakingToken` is set in state.
     * @param token The new address of the ERC-20 compliant payment token contract
     */
    event PaymentTokenSet(bytes32 indexed domainHash, address indexed token);

    /**
     * @notice Emitted when `zeroVault` is set in state.
     * @param beneficiary The new address of the beneficiary contract or wallet
     */
    event BeneficiarySet(bytes32 indexed domainHash, address indexed beneficiary);

    function paymentConfigs(
        bytes32 domainHash
    ) external view returns (
        IERC20 token,
        address beneficiary
    );

    function stakedForDomain(bytes32 domainHash) external view returns (IERC20, uint256);

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
        bytes32 domainHash,
        address payer,
        uint256 paymentAmount,
        uint256 protocolFee
    ) external;

    function setPaymentConfig(
        bytes32 domainHash,
        PaymentConfig memory paymentConfig
    ) external;

    function setBeneficiary(
        bytes32 domainHash,
        address beneficiary
    ) external;

    function setPaymentToken(
        bytes32 domainHash,
        address paymentToken
    ) external;

    function setRegistry(address registry_) external;

    function initialize(
        address accessController_,
        address curvePricer_,
        address stakingToken_,
        address zeroVault_
    ) external;
}
