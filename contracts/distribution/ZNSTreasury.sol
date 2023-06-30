// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSPriceOracle } from "./IZNSPriceOracle.sol";
import { AccessControlled } from "../access/AccessControlled.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract ZNSTreasury is AccessControlled, UUPSUpgradeable, IZNSTreasury {
    using SafeERC20 for IERC20;

    /**
     * @notice The price oracle
     */
    IZNSPriceOracle public priceOracle;

    /**
     * @notice The payment/staking token
     */
    IERC20 public stakingToken;

    /**
     * @notice Address of the Zero Vault, a wallet or contract which gathers all the fees.
     */
    address public zeroVault;

    mapping(bytes32 domainHash => uint256 amountStaked) public stakedForDomain;

    modifier onlyRegistrar {
        accessController.checkRegistrar(msg.sender);
        _;
    }

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

        // Transfer stake amount and fee
        stakingToken.safeTransferFrom(depositor, address(this), totalPrice);
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

    function setZeroVaultAddress(address zeroVault_) public override onlyAdmin {
        require(zeroVault_ != address(0), "ZNSTreasury: zeroVault passed as 0x0 address");

        zeroVault = zeroVault_;
        emit ZeroVaultAddressSet(zeroVault_);
    }

    function setPriceOracle(address priceOracle_) public override onlyAdmin {
        require(
            priceOracle_ != address(0),
            "ZNSTreasury: priceOracle_ passed as 0x0 address"
        );

        priceOracle = IZNSPriceOracle(priceOracle_);
        emit PriceOracleSet(priceOracle_);
    }

    function setStakingToken(address stakingToken_) public override onlyAdmin {
        require(stakingToken_ != address(0), "ZNSTreasury: stakingToken_ passed as 0x0 address");

        stakingToken = IERC20(stakingToken_);
        emit StakingTokenSet(stakingToken_);
    }

    function setAccessController(address accessController_)
    public
    override(AccessControlled, IZNSTreasury)
    onlyAdmin
    {
        _setAccessController(accessController_);
    }

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
