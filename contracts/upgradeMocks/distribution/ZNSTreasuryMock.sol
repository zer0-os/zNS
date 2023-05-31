// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSTreasuryMock } from "./IZNSTreasuryMock.sol";
import { IZNSPriceOracleMock } from "./IZNSPriceOracleMock.sol";
import { AccessControlled } from "../../access/AccessControlled.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


contract ZNSTreasuryMock is AccessControlled, UUPSUpgradeable, IZNSTreasuryMock {
    /**
     * @notice The price oracle
     */
    IZNSPriceOracleMock public priceOracle;

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

    function initialize(
        address accessController_,
        address znsPriceOracle_,
        address stakingToken_,
        address zeroVault_
    ) external override initializer {
        _setAccessController(accessController_);
        setZeroVaultAddress(zeroVault_);
        // TODO change from mock
        setStakingToken(stakingToken_);
        setPriceOracle(znsPriceOracle_);
    }

    function stakeForDomain(
        bytes32 domainHash,
        string calldata domainName,
        address depositor,
        bool isTopLevelDomain
    ) external override onlyRegistrar {
        // Get price and fee for the domain
        (, uint256 stakeAmount, uint256 registrationFee) = priceOracle.getPrice(
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
    ) external override onlyRegistrar {
        uint256 stakeAmount = stakedForDomain[domainHash];
        require(stakeAmount > 0, "ZNSTreasury: No stake for domain");
        delete stakedForDomain[domainHash];

        stakingToken.transfer(owner, stakeAmount);

        emit StakeWithdrawn(domainHash, owner, stakeAmount);
    }

    function setZeroVaultAddress(address zeroVaultAddress) public override onlyAdmin {
        require(zeroVaultAddress != address(0), "ZNSTreasury: zeroVault passed as 0x0 address");

        zeroVault = zeroVaultAddress;
        emit ZeroVaultAddressSet(zeroVaultAddress);
    }

    function setPriceOracle(address priceOracle_) public override onlyAdmin {
        require(
            priceOracle_ != address(0),
            "ZNSTreasury: znsPriceOracle_ passed as 0x0 address"
        );

        priceOracle = IZNSPriceOracleMock(priceOracle_);
        emit PriceOracleSet(priceOracle_);
    }

    function setStakingToken(address stakingToken_) public override onlyAdmin {
        require(stakingToken_ != address(0), "ZNSTreasury: stakingToken_ passed as 0x0 address");

        stakingToken = IERC20(stakingToken_);
        emit StakingTokenSet(stakingToken_);
    }

    function setAccessController(address accessController_)
    public
    override(AccessControlled, IZNSTreasuryMock)
    onlyAdmin
    {
        _setAccessController(accessController_);
    }

    function getAccessController() external view override(AccessControlled, IZNSTreasuryMock) returns (address) {
        return address(accessController);
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The implementation contract to upgrade to
     */
    function _authorizeUpgrade(address newImplementation) internal override {
        accessController.checkGovernor(msg.sender);
    }
}
