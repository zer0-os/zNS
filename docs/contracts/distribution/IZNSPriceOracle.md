## IZNSPriceOracle





**`DomainPriceConfig` struct properties:**

- `maxPrice` (uint256): Maximum price for a domain returned at <= `baseLength`
- `minPrice` (uint256): Minimum price for a domain returned at > `maxLength`
- `maxLength` (uint256): Maximum length of a domain name. If the name is longer than this value we return the `minPrice`
- `baseLength` (uint256): Base length of a domain name. If the name is less than or equal to this value we return the `maxPrice`
- `precisionMultiplier` (uint256): The precision multiplier of the price. This multiplier
should be picked based on the number of token decimals to calculate properly.
e.g. if we use a token with 18 decimals, and want precision of 2,
our precision multiplier will be equal 10^18 - 10^2 = 10^16



### MaxPriceSet

```solidity
event MaxPriceSet(uint256 price)
```


Emitted when the `maxPrice` is set in `rootDomainPriceConfig`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint256 | The new maxPrice value |


### MinPriceSet

```solidity
event MinPriceSet(uint256 price)
```


Emitted when the `minPrice` is set in `rootDomainPriceConfig`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint256 | The new minPrice value |


### BaseLengthSet

```solidity
event BaseLengthSet(uint256 length)
```


Emitted when the `baseLength` is set in `rootDomainPriceConfig`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| length | uint256 | The new baseLength value |


### MaxLengthSet

```solidity
event MaxLengthSet(uint256 length)
```


Emitted when the `maxLength` is set in `rootDomainPriceConfig`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| length | uint256 | The new maxLength value |


### PrecisionMultiplierSet

```solidity
event PrecisionMultiplierSet(uint256 precision)
```


Emitted when the `precisionMultiplier` is set in `rootDomainPriceConfig`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| precision | uint256 | The new precisionMultiplier value |


### FeePercentageSet

```solidity
event FeePercentageSet(uint256 feePercentage)
```


Emitted when the `feePercentage` is set in state


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| feePercentage | uint256 | The new feePercentage value |


### PriceConfigSet

```solidity
event PriceConfigSet(uint256 maxPrice, uint256 minPrice, uint256 maxLength, uint256 baseLength, uint256 precisionMultiplier)
```


Emitted when the full `rootDomainPriceConfig` is set in state


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| maxPrice | uint256 | The new `maxPrice` value |
| minPrice | uint256 | The new `minPrice` value |
| maxLength | uint256 | The new `maxLength` value |
| baseLength | uint256 | The new `baseLength` value |
| precisionMultiplier | uint256 | The new `precisionMultiplier` value |


### DomainPriceConfig








```solidity
struct DomainPriceConfig {
  uint256 maxPrice;
  uint256 minPrice;
  uint256 maxLength;
  uint256 baseLength;
  uint256 precisionMultiplier;
}
```

### initialize

```solidity
function initialize(address accessController_, struct IZNSPriceOracle.DomainPriceConfig priceConfig_, uint256 regFeePercentage_) external
```







### getPrice

```solidity
function getPrice(string name) external view returns (uint256 totalPrice, uint256 domainPrice, uint256 fee)
```







### getRegistrationFee

```solidity
function getRegistrationFee(uint256 domainPrice) external view returns (uint256)
```







### setPriceConfig

```solidity
function setPriceConfig(struct IZNSPriceOracle.DomainPriceConfig priceConfig) external
```







### setMaxPrice

```solidity
function setMaxPrice(uint256 maxPrice) external
```







### setMinPrice

```solidity
function setMinPrice(uint256 minPrice) external
```







### setBaseLength

```solidity
function setBaseLength(uint256 length) external
```







### setMaxLength

```solidity
function setMaxLength(uint256 length) external
```







### setPrecisionMultiplier

```solidity
function setPrecisionMultiplier(uint256 multiplier) external
```







### setRegistrationFeePercentage

```solidity
function setRegistrationFeePercentage(uint256 regFeePercentage) external
```







### setAccessController

```solidity
function setAccessController(address accessController) external
```







### getAccessController

```solidity
function getAccessController() external view returns (address)
```








