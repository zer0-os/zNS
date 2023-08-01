// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSRefundablePayment } from "../abstractions/AZNSRefundablePayment.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AAccessControlled } from "../../../access/AAccessControlled.sol";
import { IZNSRegistry } from "../../../registry/IZNSRegistry.sol";


// TODO sub: do big refactoring to reuse common parts properly for all payment contracts !!
contract ZNSStakePayment is AAccessControlled, AZNSRefundablePayment {
    using SafeERC20 for IERC20;

    event StakingTokenChanged(bytes32 indexed domainHash, address newStakingToken);
    event FeeBeneficiaryChanged(bytes32 indexed domainHash, address newBeneficiary);
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
    event RegistrySet(address registry);

    // TODO sub: refactor this and other payments to use the same types !!
    struct PaymentConfig {
        IERC20 stakingToken;
        address feeBeneficiary;
    }

    IZNSRegistry public registry;

    uint256 public constant PERCENTAGE_BASIS = 10000;

    mapping(bytes32 domainHash => PaymentConfig config) internal paymentConfigs;

    mapping(bytes32 domainHash => uint256 amountStaked) public stakedForDomain;

    modifier onlyOwnerOrOperator(bytes32 domainHash) {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSStakePayment: Not authorized"
        );
        _;
    }

    constructor(address _accessController, address _registry) {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    function processPayment(
        bytes32 parentHash,
        bytes32 domainHash,
        address depositor,
        uint256 amount,
        // optional, can be 0
        // TODO sub: figure out the best system to standardize fees and make them work for any abstract
        //  how do we handle fees on payment contracts?
        //  what if we choose fee pricing, but payment contract does not allow fees ??
        uint256 fee
    ) external override onlyRegistrar {
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

        // TODO sub: or PaymentProcessed ??
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
    ) external override onlyRegistrar {
        uint256 stakedAmount = stakedForDomain[domainHash];

        // this signifies that the domain was registered
        // during a promo without a stake
        // see `processPayment()` to see that setting stakingToken to 0x0 address
        // means free domains
        if (stakedAmount == 0) return;

        delete stakedForDomain[domainHash];

        paymentConfigs[parentHash].stakingToken.safeTransfer(
            domainOwner,
            stakedAmount
        );

        emit StakeWithdrawn(parentHash, domainHash, domainOwner, stakedAmount);
    }

    function getPaymentConfig(bytes32 domainHash) external view returns (PaymentConfig memory) {
        return paymentConfigs[domainHash];
    }

    function setStakingToken(bytes32 domainHash, IERC20 stakingToken) public onlyOwnerOrOperator(domainHash) {
        paymentConfigs[domainHash].stakingToken = IERC20(stakingToken);

        emit StakingTokenChanged(domainHash, address(stakingToken));
    }

    function setFeeBeneficiary(
        bytes32 domainHash,
        address feeBeneficiary
    ) public onlyOwnerOrOperator(domainHash) {
        require(feeBeneficiary != address(0), "ZNSStakePayment: feeBeneficiary can not be 0x0 address");
        paymentConfigs[domainHash].feeBeneficiary = feeBeneficiary;

        emit FeeBeneficiaryChanged(domainHash, feeBeneficiary);
    }

    function setPaymentConfig(bytes32 domainHash, PaymentConfig calldata config) external {
        setStakingToken(domainHash, config.stakingToken);
        setFeeBeneficiary(domainHash, config.feeBeneficiary);
    }

    function setRegistry(address registry_) public onlyAdmin {
        require(registry_ != address(0), "ZNSStakePayment: _registry can not be 0x0 address");
        registry = IZNSRegistry(registry_);

        emit RegistrySet(registry_);
    }

    function setAccessController(address accessController_)
    external
    override
    onlyAdmin {
        _setAccessController(accessController_);
    }

    function getAccessController() external view override returns (address) {
        return address(accessController);
    }
}
