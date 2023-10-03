## IZNSPricer


**IZNSPricer.sol**

Base interface required to be inherited by all Pricing contracts to work with zNS




### getPrice

```solidity
function getPrice(bytes32 parentHash, string label) external view returns (uint256)
```




`parentHash` param is here to allow pricer contracts
 to have different price configs for different subdomains



### getPriceAndFee

```solidity
function getPriceAndFee(bytes32 parentHash, string label) external view returns (uint256 price, uint256 fee)
```




Fees are only supported for PaymentType.STAKE !
 This function will NOT be called if PaymentType != PaymentType.STAKE
 Instead `getPrice()` will be called.



### getFeeForPrice

```solidity
function getFeeForPrice(bytes32 parentHash, uint256 price) external view returns (uint256)
```


Returns the fee for a given price.

Fees are only supported for PaymentType.STAKE !




