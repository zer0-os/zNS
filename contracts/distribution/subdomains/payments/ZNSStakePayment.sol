// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSRefundablePayment } from "../abstractions/AZNSRefundablePayment.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


// TODO sub: do big refactoring to reuse common parts properly for all payment contracts !!
contract ZNSStakePayment is AZNSRefundablePayment {
    using SafeERC20 for IERC20;

    event StakingTokenChanged(bytes32 indexed domainHash, address newStakingToken);
    event FeeBeneficiaryChanged(bytes32 indexed domainHash, address newBeneficiary);
    event FeePercentageChanged(bytes32 indexed domainHash, address newFeePercentage);
    event StakeDeposited(
        bytes32 indexed parentHash,
        bytes32 indexed domainHash,
        address indexed staker,
        uint256 stakedAmount,
        uint256 fee
    );
    event StakeWithdrawn(
        bytes32 indexed parentHash,
        bytes32 indexed domainHash,
        address indexed domainOwner,
        uint256 stakedAmount
    );

    // TODO sub: refactor this and other payments to use the same types !!
    struct PaymentConfig {
        IERC20 stakingToken;
        address feeBeneficiary;
    }

    uint256 public constant PERCENTAGE_BASIS = 10000;

    mapping(bytes32 domainHash => PaymentConfig config) internal paymentConfigs;

    mapping(bytes32 domainHash => uint256 amountStaked) public stakedForDomain;

    // TODO sub: do we add a fee here ??
    // TODO sub: add events !!
    function processPayment(
        bytes32 parentHash,
        bytes32 domainHash,
        address depositor,
        uint256 amount,
        // optional, can be 0
        // TODO sub: figure out the best system to standardize fees and make them work for any abstract
        uint256 fee
    ) external override {
        // TODO sub: can this be a single read with no memory var ??
        PaymentConfig memory config = paymentConfigs[parentHash];

        // setting paymentToken to 0x0 address means free domains
        // to save on tx costs, we avoid transfering 0
        // TODO sub: is this a good way to do option for free domains ??
        //  what about a point in time where an owner hasn't yet set the rules ??
        //  will having a default of AccessType.LOCKED prevent this ?? (TEST!)
        if (address(config.stakingToken) == address(0)) return;

        // Transfer stake amount and fee to this contract
        config.stakingToken.safeTransferFrom(
            depositor,
            address(this),
            amount + fee
        );

        if (fee != 0) {
            // Transfer the fee to the `feeBeneficiary` from this contract
            config.stakingToken.safeTransfer(
                config.feeBeneficiary,
                fee
            );
        }

        // Record staked amount for this domain
        stakedForDomain[domainHash] = amount;

        emit StakeDeposited(
            parentHash,
            domainHash,
            depositor,
            amount,
            fee
        );
    }

    function refund(
        bytes32 parentHash,
        bytes32 domainHash,
        address domainOwner
    ) external override {
        uint256 stakedAmount = stakedForDomain[domainHash];
        require(stakedAmount > 0, "ZNSStakePayment: No stake for domain");
        delete stakedForDomain[domainHash];

        paymentConfigs[parentHash].stakingToken.safeTransfer(
            domainOwner,
            stakedAmount
        );

        emit StakeWithdrawn(parentHash, domainHash, domainOwner, stakedAmount);
    }

    // TODO sub: add other config setters with AC !!
    function getPaymentConfig(bytes32 domainHash) external view returns (PaymentConfig memory) {
        return paymentConfigs[domainHash];
    }

    // TODO sub: add AC !! and expand to set all config params !!
    function setPaymentConfig(bytes32 domainHash, PaymentConfig calldata config) external {
        paymentConfigs[domainHash] = config;
        // TODO sub: emit event !! add checks !!
    }
}
