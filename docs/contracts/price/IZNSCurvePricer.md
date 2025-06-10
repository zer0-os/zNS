## IZNSCurvePricer

### CurvePriceConfig

Struct for each configurable variable for price and fee calculations.

```solidity
struct CurvePriceConfig {
  uint256 maxPrice;
  uint256 curveMultiplier;
  uint256 maxLength;
  uint256 baseLength;
  uint256 precisionMultiplier;
  uint256 feePercentage;
}
```

### InvalidPrecisionMultiplierPassed

```solidity
error InvalidPrecisionMultiplierPassed()
```

Reverted when multiplier passed by the domain owner
is equal to 0 or more than 10^18, which is too large.

### MaxLengthSmallerThanBaseLength

```solidity
error MaxLengthSmallerThanBaseLength()
```

Reverted when `maxLength` smaller than `baseLength`.

### DivisionByZero

```solidity
error DivisionByZero()
```

Reverted when `curveMultiplier` AND `baseLength` are 0.

### encodeConfig

```solidity
function encodeConfig(struct IZNSCurvePricer.CurvePriceConfig config) external pure returns (bytes)
```

### decodePriceConfig

```solidity
function decodePriceConfig(bytes priceConfig) external pure returns (struct IZNSCurvePricer.CurvePriceConfig)
```

