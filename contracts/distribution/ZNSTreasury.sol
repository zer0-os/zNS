// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSPriceOracle } from "./IZNSPriceOracle.sol";
import { AccessControlled } from "../access/AccessControlled.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title Contract responsible for all staking operations in ZNS.
 * @notice This contract it called by {ZNSRegistrar} every time a staking operation is needed.
 * It stores all data regarding user stakes for domains, and it's also the only contract
 * that is aware of the {ZNSPriceOracle} which it uses to get pricing data for domains.
 */
contract ZNSTreasury is AccessControlled, UUPSUpgradeable, IZNSTreasury {
    using SafeERC20 for IERC20;

    /**
     * @notice The address of the {ZNSPriceOracle} contract.
     */
    IZNSPriceOracle public priceOracle;

    /**
     * @notice The address of the payment/staking token. Will be set to $ZERO.
     */
    IERC20 public stakingToken;

    /**
     * @notice Address of the Zero Vault, a wallet or contract which gathers all the registration fees.
     */
    address public zeroVault;

    /**
     * @notice The main mapping of the contract. It stores the amount staked for each domain
     * which is mapped to the domain hash.
     * Note that there is no address to which the stake is tied to. Instead, the owner data from {ZNSRegistry}
     * is used to identify a user who owns the stake. So the staking data is tied to the owner of the Name.
     * This should be taken into account, since any transfer of the Token to another address,
     * and the system, allowing them to Reclaim the Name, will also allow them to withdraw the stake.
     * > Stake is owned by the owner of the Name in {ZNSRegistry}!
     */
    mapping(bytes32 domainHash => uint256 amountStaked) public stakedForDomain;

    /**
     * @notice Modifier used for functions that are only allowed to be called by the {ZNSRegistrar}
     * or any other address that has REGISTRAR_ROLE.
     */
    modifier onlyRegistrar {
        accessController.checkRegistrar(msg.sender);
        _;
    }

    /**
     * @notice {ZNSTreasury} proxy state initializer. Note that setter functions are used
     * instead of direct state variable assignments in order to use proper Access Control
     * at initialization. Only ADMIN in {ZNSAccessController} can call this function.
     * For this also, it is important that {ZNSAccessController} is deployed and initialized with role data
     * before this contract is deployed.
     * @param accessController_ The address of the {ZNSAccessController} contract.
     * @param priceOracle_ The address of the {ZNSPriceOracle} contract.
     * @param stakingToken_ The address of the staking token (currently $ZERO).
     * @param zeroVault_ The address of the Zero Vault - the wallet or contract to collect all the registration fees.
     */
    function initialize(
        address accessController_,
        address priceOracle_,
        address stakingToken_,
        address zeroVault_
    ) external override initializer {
        _setAccessController(accessController_);
        setZeroVaultAddress(zeroVault_);
        setStakingToken(stakingToken_);
        setPriceOracle(priceOracle_);
    }

    /**
     * @notice Deposits the stake for a domain. This function is called by {ZNSRegistrar}
     * when a user wants to Register a domain. It transfers the stake amount and the registration fee
     * to the contract from the user, and records the staked amount for the domain.
     * Note that a user has to approve the correct amount of `domainPrice + registrationFee`
     * for this function to not revert.
     * Calls {ZNSPriceOracle} to get the price for the domain name based on it's length,
     * and to get a proper `registrationFee` as a percentage of the price.
     * In order to avoid needing 2 different approvals, it withdraws `domainPrice + registrationFee`
     * to this contract and then transfers the `registrationFee` to the Zero Vault.
     * Sets the `stakedForDomain` mapping for the domain to the `stakeAmount` and emits a {StakeDeposited} event.
     * @param domainHash The hash of the domain for which the stake is being deposited.
     * @param domainName The name of the domain for which the stake is being deposited.
     * @param depositor The address of the user who is depositing the stake.
     */
    function stakeForDomain(
        bytes32 domainHash,
        string calldata domainName,
        address depositor
    ) external override onlyRegistrar {
        // Get price and fee for the domain
        (
            uint256 totalPrice,
            uint256 stakeAmount,
            uint256 registrationFee
        ) = priceOracle.getPrice(
            domainName
        );

        // Transfer stake amount and fee to this address
        stakingToken.safeTransferFrom(depositor, address(this), totalPrice);
        // Transfer registration fee to the Zero Vault from this address
        stakingToken.safeTransfer(zeroVault, registrationFee);

        // Record staked amount for this domain
        stakedForDomain[domainHash] = stakeAmount;

        emit StakeDeposited(
            domainHash,
            domainName,
            depositor,
            stakeAmount,
            registrationFee
        );
    }

    /**
     * @notice Withdraws the stake for a domain. This function is called by {ZNSRegistrar}
     * when a user wants to Revoke a domain. It transfers the stake amount from the contract back to the user,
     * and deletes the staked amount for the domain in state.
     * Emits a {StakeWithdrawn} event.
     * Since we are clearing a slot in storage, gas refund from this operation makes Revoke transactions cheaper.
     * @param domainHash The hash of the domain for which the stake is being withdrawn.
     * @param owner The address of the user who is withdrawing the stake.
     */
    function unstakeForDomain(
        bytes32 domainHash,
        address owner
    ) external override onlyRegistrar {
        uint256 stakeAmount = stakedForDomain[domainHash];
        require(stakeAmount > 0, "ZNSTreasury: No stake for domain");
        delete stakedForDomain[domainHash];

        stakingToken.safeTransfer(owner, stakeAmount);

        emit StakeWithdrawn(domainHash, owner, stakeAmount);
    }

    /**
     * @notice Setter function for the {zeroVault} state variable.
     * Only ADMIN in {ZNSAccessController} can call this function.
     * @param zeroVault_ The address of the new Zero Vault -
     * - the wallet or contract to collect all the registration fees.
     */
    function setZeroVaultAddress(address zeroVault_) public override onlyAdmin {
        require(zeroVault_ != address(0), "ZNSTreasury: zeroVault passed as 0x0 address");

        zeroVault = zeroVault_;
        emit ZeroVaultAddressSet(zeroVault_);
    }

    /**
     * @notice Setter function for the {priceOracle} state variable.
     * Only ADMIN in {ZNSAccessController} can call this function.
     * @param priceOracle_ The address of the new {ZNSPriceOracle} contract.
     */
    function setPriceOracle(address priceOracle_) public override onlyAdmin {
        require(
            priceOracle_ != address(0),
            "ZNSTreasury: priceOracle_ passed as 0x0 address"
        );

        priceOracle = IZNSPriceOracle(priceOracle_);
        emit PriceOracleSet(priceOracle_);
    }

    /**
     * @notice Setter function for the {stakingToken} state variable.
     * Only ADMIN in {ZNSAccessController} can call this function.
     * @param stakingToken_ The address of the new staking token (currently $ZERO).
     */
    function setStakingToken(address stakingToken_) public override onlyAdmin {
        require(stakingToken_ != address(0), "ZNSTreasury: stakingToken_ passed as 0x0 address");

        stakingToken = IERC20(stakingToken_);
        emit StakingTokenSet(stakingToken_);
    }

    /**
     * @notice Setter function for the {accessController} state variable.
     * Only ADMIN in {ZNSAccessController} can call this function.
     * @param accessController_ The address of the new {ZNSAccessController} contract.
     */
    function setAccessController(address accessController_)
    public
    override(AccessControlled, IZNSTreasury)
    onlyAdmin
    {
        _setAccessController(accessController_);
    }

    /**
     * @notice Getter function for the {accessController} state variable inherited from {AccessControlled}.
     */
    function getAccessController() external view override(AccessControlled, IZNSTreasury) returns (address) {
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
