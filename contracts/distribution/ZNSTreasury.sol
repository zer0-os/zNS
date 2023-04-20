// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IZNSTreasury} from "./IZNSTreasury.sol";
import {IZNSEthRegistrar} from "./IZNSEthRegistrar.sol";
import {IZNSPriceOracle} from "./IZNSPriceOracle.sol";
import {IZeroTokenMock} from "../token/mocks/IZeroTokenMock.sol"; // TODO: fix when token is sorted out

// TODO is this an appropriate name??
contract ZNSTreasury is IZNSTreasury {
  // TODO: possibly move these constants to PriceOracle. make the fee percentages state vars??
  uint256 public constant PERCENTAGE_BASIS = 10000;
  uint256 public constant FEE_PERCENTAGE = 222; // 2.22% in basis points (parts per 10,000)

  IZNSEthRegistrar private znsRegistrar;
  IZNSPriceOracle public znsPriceOracle;
  IZeroTokenMock public zeroToken;

  // TODO should this be tied to domain hash only?? do we need extra data here??
  mapping(bytes32 domainName => uint256 amountStaked) private stakedForDomain;

  // TODO: remove and change when Oracle is ready
  // mapping(uint256 => uint256) public priceOraclePrices;

  modifier onlyRegistrar() {
    require(
      msg.sender == address(znsRegistrar),
      "ZNSTreasury: Only ZNSRegistrar is allowed to call"
    );
    _;
  }

  constructor(address znsPriceOracle_, address zeroToken_) {
    // TODO change from mock
    zeroToken = IZeroTokenMock(zeroToken_);
    znsPriceOracle = IZNSPriceOracle(znsPriceOracle_);
  }

  function stakeForDomain(
    bytes32 domainHash,
    string calldata domainName,
    address depositor,
    bool useFee
  ) external onlyRegistrar {
    // When `useFee` is true, it's a top level domain
    uint256 stakeAmount = znsPriceOracle.getPrice(domainName, useFee);

    // Take the payment as a staking deposit
    zeroToken.transferFrom(depositor, address(this), stakeAmount);

    if (useFee) {
      // Burn the deflation fee
      uint256 deflationFee = (stakeAmount * FEE_PERCENTAGE) / PERCENTAGE_BASIS;
      zeroToken.burn(address(this), deflationFee);
    }

    // Add staked data
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

  function setZnsRegistrar(address _znsRegistrar) external {
    // onlyAdmin { TODO: add access control !!
    require(
      _znsRegistrar != address(0),
      "ZNSTreasury: Zero address passed as _znsRegistrar"
    );

    znsRegistrar = IZNSEthRegistrar(_znsRegistrar);
    emit ZNSRegistrarSet(_znsRegistrar);
  }

  function getZnsRegistrar() external view returns (address) {
    return address(znsRegistrar);
  }
}
