// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSTreasury } from "./IZNSTreasury.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { PaymentConfig } from "./IZNSTreasury.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";


/**
 * @title Contract responsible for all staking operations in ZNS and communication with `ZNSCurvePricer`.
 * @notice This contract it called by `ZNSRootRegistrar.sol` every time a staking operation is needed.
 * It stores all data regarding user stakes for domains, and it's also the only contract
 * that is aware of the `ZNSCurvePricer` which it uses to get pricing data for domains.
 */
contract ZNSTreasury is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSTreasury {
    using SafeERC20 for IERC20;

    mapping(bytes32 => PaymentConfig) public override paymentConfigs;

    /**
     * @notice The main mapping of the contract. It stores the amount staked for each domain
     * which is mapped to the domain hash.
     * Note that there is no address to which the stake is tied to. Instead, the owner data from `ZNSRegistry`
     * is used to identify a user who owns the stake. So the staking data is tied to the owner of the Name.
     * This should be taken into account, since any transfer of the Token to another address,
     * and the system, allowing them to Reclaim the Name, will also allow them to withdraw the stake.
     * > Stake is owned by the owner of the Name in `ZNSRegistry`!
     */
    mapping(bytes32 domainHash => Stake stakeData) public override stakedForDomain;

    /**
     * @notice `ZNSTreasury` proxy state initializer. Note that setter functions are used
     * instead of direct state variable assignments in order to use proper Access Control
     * at initialization. Only ADMIN in `ZNSAccessController` can call this function.
     * For this also, it is important that `ZNSAccessController` is deployed and initialized with role data
     * before this contract is deployed.
     * @param accessController_ The address of the `ZNSAccessController` contract.
     * @param registry_ The address of the `ZNSRegistry` contract.
     * @param paymentToken_ The address of the staking token (currently $ZERO).
     * @param zeroVault_ The address of the Zero Vault - the wallet or contract to collect all the registration fees.
     */
    function initialize(
        address accessController_,
        address registry_,
        address paymentToken_,
        address zeroVault_
    ) external override initializer {
        _setAccessController(accessController_);
        _setRegistry(registry_);

        require(
            paymentToken_ != address(0),
            "ZNSTreasury: paymentToken_ passed as 0x0 address"
        );
        require(
            zeroVault_ != address(0),
            "ZNSTreasury: zeroVault_ passed as 0x0 address"
        );

        paymentConfigs[0x0] = PaymentConfig({
            token: IERC20(paymentToken_),
            beneficiary : zeroVault_
        });
    }

    /**
     * @notice Deposits the stake for a domain. This function is called by `ZNSRootRegistrar.sol`
     * when a user wants to Register a domain. It transfers the stake amount and the registration fee
     * to the contract from the user, and records the staked amount for the domain.
     * Note that a user has to approve the correct amount of `domainPrice + registrationFee`
     * for this function to not revert.
     *
     * Calls `ZNSCurvePricer.sol` to get the price for the domain name based on it's length,
     * and to get a proper `registrationFee` as a percentage of the price.
     * In order to avoid needing 2 different approvals, it withdraws `domainPrice + registrationFee`
     * to this contract and then transfers the `registrationFee` to the Zero Vault.
     * Sets the `stakedForDomain` mapping for the domain to the `stakeAmount` and emits a `StakeDeposited` event.
     * @param domainHash The hash of the domain for which the stake is being deposited.
     * @param depositor The address of the user who is depositing the stake.
     */
    function stakeForDomain(
        bytes32 parentHash,
        bytes32 domainHash,
        address depositor,
        uint256 stakeAmount,
        uint256 stakeFee,
        uint256 protocolFee
    ) external override onlyRegistrar {
        PaymentConfig memory parentConfig = paymentConfigs[parentHash];

        // Transfer stake amount and fee to this address
        parentConfig.token.safeTransferFrom(
            depositor,
            address(this),
            stakeAmount + stakeFee + protocolFee
        );

        // Transfer registration fee to the Zero Vault from this address
        parentConfig.token.safeTransfer(
            paymentConfigs[0x0].beneficiary,
            protocolFee
        );

        // transfer parent fee to the parent owner if it's not 0
        if (stakeFee != 0) {
            parentConfig.token.safeTransfer(
                parentConfig.beneficiary,
                stakeFee
            );
        }

        // Record staked amount for this domain
        stakedForDomain[domainHash] = Stake({
            token: parentConfig.token,
            amount: stakeAmount
        });

        emit StakeDeposited(
            parentHash,
            domainHash,
            depositor,
            address(parentConfig.token),
            stakeAmount,
            stakeFee,
            protocolFee
        );
    }

    /**
     * @notice Withdraws the stake for a domain. This function is called by `ZNSRootRegistrar.sol`
     * when a user wants to Revoke a domain. It transfers the stake amount from the contract back to the user,
     * and deletes the staked amount for the domain in state.
     * Emits a `StakeWithdrawn` event.
     * Since we are clearing a slot in storage, gas refund from this operation makes Revoke transactions cheaper.
     * @param domainHash The hash of the domain for which the stake is being withdrawn.
     * @param owner The address of the user who is withdrawing the stake.
     */
    function unstakeForDomain(
        bytes32 domainHash,
        address owner
    ) external override onlyRegistrar {
        Stake memory stakeData = stakedForDomain[domainHash];
        delete stakedForDomain[domainHash];

        // TODO sub: TEST that this works with any token
        // TODO sub: and that this works when parent changes the paymentConfig.token !!!
        stakeData.token.safeTransfer(owner, stakeData.amount);

        emit StakeWithdrawn(
            domainHash,
            owner,
            address(stakeData.token),
            stakeData.amount
        );
    }

    function processDirectPayment(
        bytes32 parentHash,
        bytes32 domainHash,
        address payer,
        uint256 paymentAmount,
        uint256 protocolFee
    ) external override onlyRegistrar {
        PaymentConfig memory parentConfig = paymentConfigs[parentHash];

        // Transfer payment to parent beneficiary from payer
        parentConfig.token.safeTransferFrom(
            payer,
            parentConfig.beneficiary,
            paymentAmount
        );

        // Transfer registration fee to the Zero Vault from payer
        parentConfig.token.safeTransferFrom(
            payer,
            paymentConfigs[0x0].beneficiary,
            protocolFee
        );

        emit DirectPaymentProcessed(
            parentHash,
            domainHash,
            payer,
            parentConfig.beneficiary,
            paymentAmount,
            protocolFee
        );
    }

    // TODO sub: can we refactor this as in other contracts,
    //  so that we don't call 2 functions for 1 config ??
    function setPaymentConfig(
        bytes32 domainHash,
        PaymentConfig memory paymentConfig
    ) external override {
        setBeneficiary(domainHash, paymentConfig.beneficiary);
        setPaymentToken(domainHash, address(paymentConfig.token));
    }

    /**
     * @notice Setter function for the `beneficiary` address chosen by domain owner.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param domainHash The hash of the domain to set beneficiary for
     * @param beneficiary The address of the new beneficiary
     *  - the wallet or contract to collect all payments for the domain.
     */
    function setBeneficiary(
        bytes32 domainHash,
        address beneficiary
    ) public override onlyOwnerOrOperator(domainHash) {
        require(beneficiary != address(0), "ZNSTreasury: beneficiary passed as 0x0 address");

        paymentConfigs[domainHash].beneficiary = beneficiary;
        emit BeneficiarySet(domainHash, beneficiary);
    }

    /**
     * @notice Setter function for the `paymentToken` chosen by the domain owner.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param paymentToken The address of the new payment/staking token (currently $ZERO).
     */
    function setPaymentToken(
        bytes32 domainHash,
        address paymentToken
    ) public override onlyOwnerOrOperator(domainHash) {
        require(paymentToken != address(0), "ZNSTreasury: paymentToken passed as 0x0 address");

        paymentConfigs[domainHash].token = IERC20(paymentToken);
        emit PaymentTokenSet(domainHash, paymentToken);
    }

    /**
     * @notice Setter function for the `accessController` state variable.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param accessController_ The address of the new `ZNSAccessController` contract.
     */
    function setAccessController(address accessController_)
    public
    override(AAccessControlled, IZNSTreasury)
    onlyAdmin
    {
        _setAccessController(accessController_);
    }

    function setRegistry(
        address registry_
    ) external override(ARegistryWired, IZNSTreasury) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Getter function for the `accessController` state variable inherited from `AAccessControlled.sol`.
     */
    function getAccessController() external view override(AAccessControlled, IZNSTreasury) returns (address) {
        return address(accessController);
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The implementation contract to upgrade to
     */
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
