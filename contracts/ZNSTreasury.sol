// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import ".\mocks\IZeroTokenMock.sol";


// TODO is this an appropriate name??
contract ZNSTreasury {

    // TODO: possibly move these constants to PriceOracle. make the fee percentages state vars??
    uint256 public constant PERCENTAGE_BASIS = 10000;
    uint256 public constant FEE_PERCENTAGE = 222; // 2.22% in basis points (parts per 10,000)

    IZNSEthRegistrar private znsRegistrar;

    IPriceORacle public priceOracle;
    IZeroTokenMock public zeroToken;

    // TODO should this be tied to domain hash only?? do we need extra data here??
    mapping(bytes32 => uint256) private domainStakes;


    // TODO: remove and change when Oracle is ready
    mapping(uint256 => uint256) public priceOracle__prices;


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
        require(_priceOracle != address(0), "ZNSTreasury: Zero address passed as _priceOracle");
        require(_zeroToken != address(0), "ZNSTreasury: Zero address passed as _zeroToken");

        // TODO: change from mock
        zeroToken = IZeroTokenMock(_zeroToken);
        priceOracle = IPriceOracle(_priceOracle);

        // TODO:    switch to ZNSPriceOracle call
        //          we need this here for the prototype testing only! remove when ready
        priceOracle__prices[_length] = _price;
    }

    function stakeForDomain(bytes32 domainHash, string name, address depositor, bool useFee) external onlyRegistrar {
        // TODO:    there should probably be storage structure on PriceOracle for subdomain prices
        //          that is separate from root domains
        // get prices and fees
        uint256 pricePerDomain = priceOracle__prices[name.length];

        // take the payment as a staking deposit
        // TODO: should we transfer both price and fee here or can we burn deflationFee without transfer ??
        zeroToken.transferFrom(
            depositor,
            address(this),
            pricePerDomain
        );

        if (useFee) {
            uint256 deflationFee = pricePerDomain * FEE_PERCENTAGE / PERCENTAGE_BASIS;

            // TODO:    is this how we want to burn?
            // burn the deflation fee
            zeroToken.burn(address(this), deflationFee);
        }

        // add stake data on the contract
        domainStakes[domainHash] = pricePerDomain;
    }

    function getStakedAmountForDomain(bytes32 domainHash) public returns (uint256) {
        return domainStakes[domainHash];
    }

    function setZnsRegistrar(address _znsRegistrar) external onlyAdmin {
        require(_znsRegistrar != address(0), "ZNSTreasury: Zero address passed as _znsRegistrar");

        znsRegistrar = _znsRegistrar;
        emit ZNSRegistrarSet(_znsRegistrar);
    }

    function getZnsRegistrar() external returns (address) {
        return address(znsRegistrar);
    }
}
