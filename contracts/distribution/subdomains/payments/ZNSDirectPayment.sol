// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AAccessControlled } from "../../../access/AAccessControlled.sol";
import { ARegistryWired } from "../../../abstractions/ARegistryWired.sol";
import { AZNSPayment } from "../abstractions/AZNSPayment.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract ZNSDirectPayment is AAccessControlled, ARegistryWired, AZNSPayment {
    using SafeERC20 for IERC20;


    constructor(address _accessController, address _registry) {
        _setAccessController(_accessController);
        setRegistry(_registry);
    }

    function processPayment(
        bytes32 parentHash,
        bytes32 domainHash,
        address payer,
        uint256 amount,
        // can be 0 if no fees
        uint256 fee
    ) external override onlyRegistrar {
        PaymentConfig memory config = paymentConfigs[parentHash];

        // setting paymentToken to 0x0 address means free domains
        // to save on tx costs, we avoid transfering 0
        if (address(config.paymentToken) != address(0)) {
            config.paymentToken.safeTransferFrom(
                payer,
                config.beneficiary,
                amount + fee
            );

            emit PaymentProcessed(parentHash, domainHash, payer, amount, fee);
        }

        // TODO sub: do we need an event here that will signify it was a free payment ??
    }

    function getPaymentConfig(bytes32 domainHash) external view returns (PaymentConfig memory) {
        return paymentConfigs[domainHash];
    }

    // TODO sub: 2. is this the best way?
    function setPaymentConfig(
        bytes32 domainHash,
        PaymentConfig memory configToSet
    ) external {
        setPaymentToken(domainHash, configToSet.paymentToken);
        setPaymentBeneficiary(domainHash, configToSet.beneficiary);
    }

    // TODO sub: what about types here? should we do address instead?
    function setPaymentToken(bytes32 domainHash, IERC20 paymentToken) public onlyOwnerOrOperator(domainHash) {
        paymentConfigs[domainHash].paymentToken = paymentToken;

        emit PaymentTokenChanged(domainHash, address(paymentToken));
    }

    function setPaymentBeneficiary(bytes32 domainHash, address beneficiary) public onlyOwnerOrOperator(domainHash) {
        require(beneficiary != address(0), "ZNSDirectPayment: beneficiary cannot be 0x0 address");
        paymentConfigs[domainHash].beneficiary = beneficiary;

        emit PaymentBeneficiaryChanged(domainHash, beneficiary);
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
}
