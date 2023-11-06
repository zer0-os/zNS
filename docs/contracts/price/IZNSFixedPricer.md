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
  bool isSet;
}
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
function getPrice(bytes32 parentHash, string label, bool skipValidityCheck) external view returns (uint256)
```




`parentHash` param is here to allow pricer contracts
 to have different price configs for different subdomains
`skipValidityCheck` param is added to provide proper revert when the user is
calling this to find out the price of a domain that is not valid. But in Registrar contracts
we want to do this explicitly and before we get the price to have lower tx cost for reverted tx.
So Registrars will pass this bool as "true" to not repeat the validity check.
Note that if calling this function directly to find out the price, a user should always pass "false"
as `skipValidityCheck` param, otherwise, the price will be returned for an invalid label that is not
possible to register.



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
function getPriceAndFee(bytes32 parentHash, string label, bool skipValidityCheck) external view returns (uint256 price, uint256 fee)
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








