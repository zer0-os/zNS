// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSPriceOracle } from "./IZNSPriceOracle.sol";
import { AccessControlled } from "../access/AccessControlled.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract ZNSTreasury is AccessControlled, IZNSTreasury {
    /**
     * @notice The price oracle
     */
    IZNSPriceOracle public znsPriceOracle;

    /**
     * @notice The payment/staking token
     */
    // TODO: this should be changed to be more general
    //  we might not use ZERO, but any other token here
    //  so change the naming and change the interface for IERC20,
    //  instead of a specific ZERO token interface!
    //  Make sure it is general on all contracts where it's present!
    // TODO: change all transfer calls to safeTransfer!
    IERC20 public stakingToken;

    /**
     * @notice Address of the Zero Vault, a wallet or contract which gathers all the fees.
     */
    address public zeroVault;

    mapping(bytes32 domainHash => uint256 amountStaked) public stakedForDomain;


    constructor(
        address accessController_,
        address znsPriceOracle_,
        address stakingToken_,
        address zeroVault_
    ) {
        _setAccessController(accessController_);
        _setZeroVaultAddress(zeroVault_);
        // TODO change from mock
        setStakingToken(stakingToken_);
        setPriceOracle(znsPriceOracle_);
    }

    function stakeForDomain(
        bytes32 domainHash,
        string calldata domainName,
        address depositor,
        bool isTopLevelDomain
    ) external override onlyRole(REGISTRAR_ROLE) {
        // Get price and fee for the domain
        (, uint256 stakeAmount, uint256 registrationFee) = znsPriceOracle.getPrice(
            domainName,
            isTopLevelDomain
        );

      // Transfer stake amount and fee
      stakingToken.transferFrom(depositor, address(this), stakeAmount);
      // TODO make sure we show the approval process to the user here to avoid failed transfer
      // TODO can we make it so it needs a single approval only?!
      stakingToken.transferFrom(depositor, zeroVault, registrationFee);

        // Record staked amount for this domain
        stakedForDomain[domainHash] = stakeAmount;

        emit StakeDeposited(domainHash, domainName, depositor, stakeAmount);
    }

    function unstakeForDomain(
        bytes32 domainHash,
        address owner
    ) external override onlyRole(REGISTRAR_ROLE) {
        uint256 stakeAmount = stakedForDomain[domainHash];
        require(stakeAmount > 0, "ZNSTreasury: No stake for domain");
        delete stakedForDomain[domainHash];

        stakingToken.transfer(owner, stakeAmount);

        emit StakeWithdrawn(domainHash, owner, stakeAmount);
    }

    function setZeroVaultAddress(address zeroVaultAddress) external override onlyRole(ADMIN_ROLE) {
        _setZeroVaultAddress(zeroVaultAddress);
    }

    // TODO AC: should we call a protected function in the constructor/initialize?
    function setPriceOracle(address znsPriceOracle_) public override onlyRole(ADMIN_ROLE) {
        require(
            znsPriceOracle_ != address(0),
            "ZNSTreasury: znsPriceOracle_ passed as 0x0 address"
        );

          znsPriceOracle = IZNSPriceOracle(znsPriceOracle_);
          emit ZnsPriceOracleSet(znsPriceOracle_);
    }

    function setStakingToken(address stakingToken_) public override onlyRole(ADMIN_ROLE) {
        require(stakingToken_ != address(0), "ZNSTreasury: stakingToken_ passed as 0x0 address");

        stakingToken = IERC20(stakingToken_);
        emit ZnsStakingTokenSet(stakingToken_);
    }

    function setAccessController(address accessController_) external override onlyRole(ADMIN_ROLE) {
        _setAccessController(accessController_);
    }

    function _setZeroVaultAddress(address zeroVaultAddress) internal {
        require(zeroVaultAddress != address(0), "ZNSTreasury: zeroVault passed as 0x0 address");

        zeroVault = zeroVaultAddress;
        emit ZeroVaultAddressSet(zeroVaultAddress);
    }
}
