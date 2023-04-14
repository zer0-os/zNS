// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSEthRegistrar } from "./IZNSEthRegistrar.sol";
import { IZeroTokenMock } from "../token/mocks/IZeroTokenMock.sol"; // TODO: fix when token is sorted out

// TODO is this an appropriate name??
contract ZNSTreasury is IZNSTreasury {
  // TODO: possibly move these constants to PriceOracle. make the fee percentages state vars??
  uint256 public constant PERCENTAGE_BASIS = 10000;
  uint256 public constant FEE_PERCENTAGE = 222; // 2.22% in basis points (parts per 10,000)

  IZNSEthRegistrar private znsRegistrar;

  // TODO:    uncomment when Oracle is ready and connected
  //          change Oracle logic to call actual contract
  //    IPriceOracle public priceOracle;
  IZeroTokenMock public zeroToken;

  // TODO should this be tied to domain hash only?? do we need extra data here??
  mapping(bytes32 domainName => uint256 amountStaked) private stakedForDomain;

  // TODO: remove and change when Oracle is ready
  mapping(uint256 => uint256) public priceOraclePrices;

  modifier onlyRegistrar() {
    require(
      msg.sender == address(znsRegistrar),
      "ZNSTreasury: Only ZNSRegistrar is allowed to call"
    );
    _;
  }

  // TODO:    figure out the best order of deployment and
  //          if ZNSRegistrar address should/can be passed at construction time
  constructor(address _priceOracle, address _zeroToken) {
    require(
      _priceOracle != address(0),
      "ZNSTreasury: Zero address passed as _priceOracle"
    );
    require(
      _zeroToken != address(0),
      "ZNSTreasury: Zero address passed as _zeroToken"
    );

    // TODO: change from mock and uncomment oracle
    zeroToken = IZeroTokenMock(_zeroToken);
    //        priceOracle = IPriceOracle(_priceOracle);

    // TODO:    switch to ZNSPriceOracle call
    //          we need this here for the prototype testing only! remove when ready
    priceOraclePrices[6] = 512 * 10 ** 18;
  }

  function stakeForDomain(
    bytes32 domainHash,
    string calldata domainName,
    address depositor,
    bool useFee
  ) external onlyRegistrar {
    // TODO when we merge real PriceOracle
    uint256 stakeAmount = priceOraclePrices[bytes(domainName).length];

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
