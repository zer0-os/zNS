## IZNSFixedPricer

**IZNSFixedPricer.sol Below is the doc for FixedPriceConfig struct.**

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

Emitted when the `FixedPriceConfig.price` is set in state for a specific `domainHash`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain who sets the price for subdomains |
| newPrice | uint256 | The new price value set |

### FeePercentageSet

```solidity
event FeePercentageSet(bytes32 domainHash, uint256 feePercentage)
```

Emitted when the `FixedPriceConfig.feePercentage` is set in state for a specific `domainHash`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain who sets the feePercentage for subdomains |
| feePercentage | uint256 | The new feePercentage value set |

### FixedPriceConfig

```solidity
struct FixedPriceConfig {
  uint256 price;
  uint256 feePercentage;
}
```

### encodeConfig

```solidity
function encodeConfig(struct IZNSFixedPricer.FixedPriceConfig config) external pure returns (bytes)
```

### decodePriceConfig

```solidity
function decodePriceConfig(bytes priceConfig) external pure returns (struct IZNSFixedPricer.FixedPriceConfig)
```

