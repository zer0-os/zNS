// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSEthRegistrar } from "./IZNSEthRegistrar.sol";
import { IZNSPriceOracle } from "./IZNSPriceOracle.sol";
import { AccessControlled } from "../access/AccessControlled.sol";
// TODO: fix when token is sorted out !!!
import { IZeroTokenMock } from "../token/mocks/IZeroTokenMock.sol";


contract ZNSTreasury is AccessControlled, IZNSTreasury {
  /**
   * @notice The address of the registrar we are using
   */
  // TODO AC: do we need this var in this contract at all?! it's not used anywhere
  address public znsRegistrar;

  /**
   * @notice The price oracle
   */
  IZNSPriceOracle public znsPriceOracle;

  /**
   * @notice The payment/staking token
   */
  IZeroTokenMock public zeroToken;

  /**
   * @notice Address of the Zero Vault, a wallet or contract which gathers all the fees.
   */
  address public zeroVault;

  mapping(bytes32 domainHash => uint256 amountStaked) public stakedForDomain;


  constructor(
    address accessController_,
    // TODO: why some of these are contracts and others are addresses?
    IZNSPriceOracle znsPriceOracle_,
    IZeroTokenMock zeroToken_,
    address znsRegistrar_,
    address zeroVault_
  ) {
    _setAccessController(accessController_);
    _setZeroVaultAddress(zeroVault_);
    // TODO change from mock
    zeroToken = zeroToken_;
    znsPriceOracle = znsPriceOracle_;
    znsRegistrar = znsRegistrar_;
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
    zeroToken.transferFrom(depositor, address(this), stakeAmount);
    // TODO make sure we show the approval process to the user here to avoid failed transfer
    // TODO can we make it so it needs a single approval only?!
    zeroToken.transferFrom(depositor, zeroVault, registrationFee);

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

    // TODO: require owner == ownerOrOperator from registry?
    //  remove this comment when AccessControl is added.
    //  if proper acccess control exists here and in Registrar.revoke
    //  it will be sufficient to check the owner at the entry point
    zeroToken.transfer(owner, stakeAmount);

    emit StakeWithdrawn(domainHash, owner, stakeAmount);
  }

  function setZNSRegistrar(address znsRegistrar_) external override onlyRole(ADMIN_ROLE) {
    require(
      znsRegistrar_ != address(0),
      "ZNSTreasury: Zero address passed as znsRegistrar"
    );

    znsRegistrar = znsRegistrar_;
    emit ZNSRegistrarSet(znsRegistrar_);
  }

  function setZeroVaultAddress(address zeroVaultAddress) external override onlyRole(ADMIN_ROLE) {
    _setZeroVaultAddress(zeroVaultAddress);
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
