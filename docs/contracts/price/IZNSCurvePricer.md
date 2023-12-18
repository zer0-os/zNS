## IZNSCurvePricer

### MaxPriceSet

```solidity
event MaxPriceSet(bytes32 domainHash, uint256 price)
```

Emitted when the `maxPrice` is set in `CurvePriceConfig`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| price | uint256 | The new maxPrice value |

### MinPriceSet

```solidity
event MinPriceSet(bytes32 domainHash, uint256 price)
```

Emitted when the `minPrice` is set in `CurvePriceConfig`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| price | uint256 | The new minPrice value |

### BaseLengthSet

```solidity
event BaseLengthSet(bytes32 domainHash, uint256 length)
```

Emitted when the `baseLength` is set in `CurvePriceConfig`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| length | uint256 | The new baseLength value |

### MaxLengthSet

```solidity
event MaxLengthSet(bytes32 domainHash, uint256 length)
```

Emitted when the `maxLength` is set in `CurvePriceConfig`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| length | uint256 | The new maxLength value |

### PrecisionMultiplierSet

```solidity
event PrecisionMultiplierSet(bytes32 domainHash, uint256 precision)
```

Emitted when the `precisionMultiplier` is set in `CurvePriceConfig`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| precision | uint256 | The new precisionMultiplier value |

### FeePercentageSet

```solidity
event FeePercentageSet(bytes32 domainHash, uint256 feePercentage)
```

Emitted when the `feePercentage` is set in state

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| feePercentage | uint256 | The new feePercentage value |

### PriceConfigSet

```solidity
event PriceConfigSet(bytes32 domainHash, uint256 maxPrice, uint256 minPrice, uint256 maxLength, uint256 baseLength, uint256 precisionMultiplier, uint256 feePercentage)
```

Emitted when the full `CurvePriceConfig` is set in state

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| maxPrice | uint256 | The new `maxPrice` value |
| minPrice | uint256 | The new `minPrice` value |
| maxLength | uint256 | The new `maxLength` value |
| baseLength | uint256 | The new `baseLength` value |
| precisionMultiplier | uint256 | The new `precisionMultiplier` value |
| feePercentage | uint256 |  |

### initialize

```solidity
function initialize(address accessController_, address registry_, struct ICurvePriceConfig.CurvePriceConfig zeroPriceConfig_) external
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

### getFeeForPrice

```solidity
function getFeeForPrice(bytes32 parentHash, uint256 price) external view returns (uint256)
```

Returns the fee for a given price.

Fees are only supported for PaymentType.STAKE !

### getPriceAndFee

```solidity
function getPriceAndFee(bytes32 parentHash, string label, bool skipValidityCheck) external view returns (uint256 price, uint256 stakeFee)
```

Fees are only supported for PaymentType.STAKE !
 This function will NOT be called if PaymentType != PaymentType.STAKE
 Instead `getPrice()` will be called.

### setPriceConfig

```solidity
function setPriceConfig(bytes32 domainHash, struct ICurvePriceConfig.CurvePriceConfig priceConfig) external
```

### setMaxPrice

```solidity
function setMaxPrice(bytes32 domainHash, uint256 maxPrice) external
```

### setMinPrice

```solidity
function setMinPrice(bytes32 domainHash, uint256 minPrice) external
```

### setBaseLength

```solidity
function setBaseLength(bytes32 domainHash, uint256 length) external
```

### setMaxLength

```solidity
function setMaxLength(bytes32 domainHash, uint256 length) external
```

### setPrecisionMultiplier

```solidity
function setPrecisionMultiplier(bytes32 domainHash, uint256 multiplier) external
```

### setFeePercentage

```solidity
function setFeePercentage(bytes32 domainHash, uint256 feePercentage) external
```

### setRegistry

```solidity
function setRegistry(address registry_) external
```

