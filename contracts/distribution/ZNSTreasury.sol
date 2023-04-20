// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IZNSTreasury} from "./IZNSTreasury.sol";
import {IZNSEthRegistrar} from "./IZNSEthRegistrar.sol";
import {IZNSPriceOracle} from "./IZNSPriceOracle.sol";
// TODO: fix when token is sorted out
import {IZeroTokenMock} from "../token/mocks/IZeroTokenMock.sol";

contract ZNSTreasury is IZNSTreasury {
  uint256 public constant PERCENTAGE_BASIS = 10000;
  uint256 public constant FEE_PERCENTAGE = 222; // 2.22% in basis points (parts per 10,000)

  IZNSEthRegistrar private znsRegistrar;
  IZNSPriceOracle public znsPriceOracle;
  IZeroTokenMock public zeroToken;

  mapping(bytes32 domainName => uint256 amountStaked) private stakedForDomain;

  mapping(address user => bool isAdmin) public admin;

  modifier onlyRegistrar() {
    require(
      msg.sender == address(znsRegistrar),
      "ZNSTreasury: Only ZNSRegistrar is allowed to call"
    );
    _;
  }

  modifier onlyAdmin() {
    require(admin[msg.sender], "ZNSTreasury: Not an allowed admin");
    _;
  }

  constructor(address znsPriceOracle_, address zeroToken_, address admin_) {
    // TODO change from mock
    zeroToken = IZeroTokenMock(zeroToken_);
    znsPriceOracle = IZNSPriceOracle(znsPriceOracle_);
    admin[admin_] = true;
  }

  function getPriceFee(uint256 stakeAmount) public pure returns (uint256) {
    return (stakeAmount * FEE_PERCENTAGE) / PERCENTAGE_BASIS;
  }

  function stakeForDomain(
    bytes32 domainHash,
    string calldata domainName,
    address depositor,
    address burnAddress, // TODO not burning, rename?
    bool isTopLevelDomain
  ) external onlyRegistrar {
    // Take the payment as a staking deposit
    uint256 stakeAmount = znsPriceOracle.getPrice(domainName, isTopLevelDomain);
    uint256 deflationFee = getPriceFee(stakeAmount);

    require(
      zeroToken.balanceOf(depositor) >= stakeAmount + deflationFee,
      "ZNSTreasury: Not enough funds"
    );

    // Transfer stake amount and fee
    zeroToken.transferFrom(
      depositor,
      address(this),
      stakeAmount
    );

    zeroToken.transferFrom(
      depositor,
      burnAddress,
      deflationFee
    );

    // Record staked amount for this domain
    stakedForDomain[domainHash] = stakeAmount;

    emit StakeDeposited(domainHash, domainName, depositor, stakeAmount);
  }

  function unstakeForDomain(
    bytes32 domainHash,
    address owner
  ) external onlyRegistrar {
    uint256 stakeAmount = stakedForDomain[domainHash];
    delete stakedForDomain[domainHash];

    // require owner == ownerOrOperator from registry?
    zeroToken.transfer(owner, stakeAmount);

    emit StakeWithdrawn(domainHash, owner, stakeAmount);
  }

  function getStakedAmountForDomain(
    bytes32 domainHash
  ) public view returns (uint256) {
    return stakedForDomain[domainHash];
  }

  function setZNSRegistrar(address _znsRegistrar) external onlyAdmin {
    require(
      _znsRegistrar != address(0),
      "ZNSTreasury: Zero address passed as _znsRegistrar"
    );

    znsRegistrar = IZNSEthRegistrar(_znsRegistrar);
    emit ZNSRegistrarSet(_znsRegistrar);
  }

  function getZNSRegistrar() external view returns (address) {
    return address(znsRegistrar);
  }

  function setAdmin(address user) external onlyAdmin {
    require(user != address(0), "ZNSTreasury: No zero address admins");
    admin[user] = true;

    emit AdminSet(user);
    // TODO emit
    // TODO if we parameterize the bool to `status` then
    // any admin can unset any other admin
  }

  function isAdmin(address user) external view returns (bool) {
    return admin[user];
  }
}
