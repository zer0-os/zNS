## IZNSFixedPricer


**IZNSFixedPricer.sol Below is the doc for PriceConfig struct.**

Struct for price configurations per domainHash that is used in the `priceConfigs` mapping
 - price The value determining how much a subdomain under a particular parent would cost
 - feePercentage The value determining how much fee is charged for a subdomain registration

Please note that the `feePercentage` is set in the basis of 10,000 where 1% = 100
 and feePercentage is NOT being read when used with PaymentType.DIRECT. This value is only
 used when PaymentType.STAKE is set in ZNSSubRegistrar.



### PriceSet

```solidity
event PriceSet(bytes32 domainHash, uint256 newPrice)
```


Emitted when the `PriceConfig.price` is set in state for a specific `domainHash`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain who sets the price for subdomains |
| newPrice | uint256 | The new price value set |


### FeePercentageSet

```solidity
event FeePercentageSet(bytes32 domainHash, uint256 feePercentage)
```


Emitted when the `PriceConfig.feePercentage` is set in state for a specific `domainHash`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain who sets the feePercentage for subdomains |
| feePercentage | uint256 | The new feePercentage value set |


### PriceConfig








```solidity
struct PriceConfig {
  uint256 price;
  uint256 feePercentage;
}
```

### priceConfigs

```solidity
function priceConfigs(bytes32 domainHash) external view returns (uint256 price, uint256 feePercentage)
```







### initialize

```solidity
function initialize(address _accessController, address _registry) external
```







### setPrice

```solidity
function setPrice(bytes32 domainHash, uint256 _price) external
```







### getPrice

```solidity
function getPrice(bytes32 parentHash, string label) external view returns (uint256)
```




`parentHash` param is here to allow pricer contracts
 to have different price configs for different subdomains



### setFeePercentage

```solidity
function setFeePercentage(bytes32 domainHash, uint256 feePercentage) external
```







### getFeeForPrice

```solidity
function getFeeForPrice(bytes32 parentHash, uint256 price) external view returns (uint256)
```


Returns the fee for a given price.

Fees are only supported for PaymentType.STAKE !



### getPriceAndFee

```solidity
function getPriceAndFee(bytes32 parentHash, string label) external view returns (uint256 price, uint256 fee)
```




Fees are only supported for PaymentType.STAKE !
 This function will NOT be called if PaymentType != PaymentType.STAKE
 Instead `getPrice()` will be called.



### setPriceConfig

```solidity
function setPriceConfig(bytes32 domainHash, struct IZNSFixedPricer.PriceConfig priceConfig) external
```







### setRegistry

```solidity
function setRegistry(address registry_) external
```








