// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSRefundablePayment } from "../abstractions/AZNSRefundablePayment.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AAccessControlled } from "../../../access/AAccessControlled.sol";
import { IZNSRegistry } from "../../../registry/IZNSRegistry.sol";
import { ARegistryWired } from "../../../abstractions/ARegistryWired.sol";


contract ZNSStakePayment is AAccessControlled, ARegistryWired, AZNSRefundablePayment {
    using SafeERC20 for IERC20;


    mapping(bytes32 domainHash => uint256 amountStaked) public stakedForDomain;

    constructor(address _accessController, address _registry) {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    function processPayment(
        bytes32 parentHash,
        bytes32 domainHash,
        address payer,
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
        if (address(config.paymentToken) == address(0)) return;

        // Transfer stake amount and fee to this contract
        config.paymentToken.safeTransferFrom(
            payer,
            address(this),
            amount + fee
        );

        if (fee != 0) {
            // Transfer the fee to the `feeBeneficiary` from this contract
            config.paymentToken.safeTransfer(
                config.beneficiary,
                fee
            );
        }

        // Record staked amount for this domain
        stakedForDomain[domainHash] = amount;

        emit PaymentProcessed(
            parentHash,
            domainHash,
            payer,
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
        // TODO sub: test this case !!
        if (stakedAmount == 0) return;

        delete stakedForDomain[domainHash];

        paymentConfigs[parentHash].paymentToken.safeTransfer(
            domainOwner,
            stakedAmount
        );

        emit RefundProcessed(parentHash, domainHash, domainOwner, stakedAmount);
    }

    function getPaymentConfig(bytes32 domainHash) external view returns (PaymentConfig memory) {
        return paymentConfigs[domainHash];
    }

    function setPaymentToken(bytes32 domainHash, IERC20 stakingToken) public onlyOwnerOrOperator(domainHash) {
        paymentConfigs[domainHash].paymentToken = IERC20(stakingToken);

        emit PaymentTokenChanged(domainHash, address(stakingToken));
    }

    function setBeneficiary(
        bytes32 domainHash,
        address beneficiary
    ) public onlyOwnerOrOperator(domainHash) {
        require(beneficiary != address(0), "ZNSStakePayment: feeBeneficiary can not be 0x0 address");
        paymentConfigs[domainHash].beneficiary = beneficiary;

        emit PaymentBeneficiaryChanged(domainHash, beneficiary);
    }

    function setPaymentConfig(bytes32 domainHash, PaymentConfig calldata config) external {
        setPaymentToken(domainHash, config.paymentToken);
        setBeneficiary(domainHash, config.beneficiary);
    }

    function setRegistry(address registry_) public override onlyAdmin {
        _setRegistry(registry_);
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

    // TODO sub: should we add some method to allow someone to withdraw any tokens that were sent to this contract
    //  without the revoke flow??
    //  What are the complications to this? It's not desirable. Need to test if fund locking is possible here !!!
    //  Do the same for ZNSTreasury !!
}
