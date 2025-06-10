## ZNSCurvePricer

**Implementation of the Curve Pricing, a module that calculates the price of a domain
based on its length and the rules set by Zero ADMIN.
This module uses a hyperbolic curve that starts at (`baseLength`; `maxPrice`)
for all domains <= `baseLength`.
Then the price is reduced using the price calculation function below.
All prices after `maxLength` are fixed and equal the price at `maxLength`.**

This contract is stateless as all the other Pricer contracts.

### PERCENTAGE_BASIS

```solidity
uint256 PERCENTAGE_BASIS
```

Value used as a basis for percentage calculations,
since Solidity does not support fractions.

### FACTOR_SCALE

```solidity
uint256 FACTOR_SCALE
```

Multiply the entire hyperbola formula by this number to be able to reduce the `curveMultiplier`
by 3 digits, which gives us more flexibility in defining the hyperbola function.

> Canot be "0".

### encodeConfig

```solidity
function encodeConfig(struct IZNSCurvePricer.CurvePriceConfig config) external pure returns (bytes)
```

Encode a given `CurvePriceConfig` struct into bytes

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| config | struct IZNSCurvePricer.CurvePriceConfig | The `CurvePriceConfig` to encode into bytes |

### decodePriceConfig

```solidity
function decodePriceConfig(bytes priceConfig) public pure returns (struct IZNSCurvePricer.CurvePriceConfig)
```

Decode bytes into a `CurvePriceConfig` struct

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceConfig | bytes | The bytes to decode |

### validatePriceConfig

```solidity
function validatePriceConfig(bytes priceConfig) public pure
```

Validate the inputs for each variable in a price config

Will revert if incoming config is invalid

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceConfig | bytes | The price config to evaluate |

### getPrice

```solidity
function getPrice(bytes parentPriceConfig, string label, bool skipValidityCheck) public pure returns (uint256)
```

Get the price of a given domain name

`skipValidityCheck` param is added to provide proper revert when the user is
calling this to find out the price of a domain that is not valid. But in Registrar contracts
we want to do this explicitly and before we get the price to have lower tx cost for reverted tx.
So Registrars will pass this bool as "true" to not repeat the validity check.
Note that if calling this function directly to find out the price, a user should always pass "false"
as `skipValidityCheck` param, otherwise, the price will be returned for an invalid label that is not
possible to register.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentPriceConfig | bytes | The hash of the parent domain under which price is determined |
| label | string | The label of the subdomain candidate to get the price for before/during registration |
| skipValidityCheck | bool | If true, skips the validity check for the label |

### getFeeForPrice

```solidity
function getFeeForPrice(bytes parentPriceConfig, uint256 price) public pure returns (uint256)
```

Part of the IZNSPricer interface - one of the functions required
for any pricing contracts used with ZNS. It returns fee for a given price
based on the value set by the owner of the parent domain.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentPriceConfig | bytes | The price config in bytes of the parent domain under which fee is determined |
| price | uint256 | The price to get the fee for |

### getPriceAndFee

```solidity
function getPriceAndFee(bytes parentPriceConfig, string label, bool skipValidityCheck) external pure returns (uint256 price, uint256 stakeFee)
```

Part of the IZNSPricer interface - one of the functions required
for any pricing contracts used with ZNS. Returns both price and fee for a given label
under the given parent.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentPriceConfig | bytes | The price config in bytes of the parent domain under which fee is determined |
| label | string | The label of the subdomain candidate to get the price and fee for before/during registration |
| skipValidityCheck | bool |  |

### _checkLength

```solidity
function _checkLength(bytes priceConfig) internal pure
```

### _getFeeForPrice

```solidity
function _getFeeForPrice(uint256 feePercentage, uint256 price) internal pure returns (uint256)
```

### _validatePriceConfig

```solidity
function _validatePriceConfig(struct IZNSCurvePricer.CurvePriceConfig config) internal pure
```

### _getPrice

```solidity
function _getPrice(struct IZNSCurvePricer.CurvePriceConfig config, uint256 length) internal pure returns (uint256)
```

Internal function to calculate price based on the config set,
and the length of the domain label.

Before we calculate the price, 6 different cases are possible:
1. `maxPrice` is 0, which means all subdomains under this parent are free
2. `baseLength` is 0, which means prices for all domains = 0 (free).
3. `length` is less or equal to `baseLength`, which means a domain will cost `maxPrice`
4. `length` is greater than `maxLength`, which means a domain will cost price by fomula at `maxLength`
5. The numerator can be less than the denominator, which is achieved by setting a huge value
for `curveMultiplier` or by decreasing the `baseLength` and `maxPrice`, which means all domains
which are longer than `baseLength` will be free.
6. `curveMultiplier` is 0, which means all domains will cost `maxPrice`.

The formula itself creates an hyperbolic curve that decreases in pricing based on domain name length,
base length, max price and curve multiplier.
`FACTOR_SCALE` allows to perceive `curveMultiplier` as fraction number in regular formula,
which helps to bend a curve of the price chart.
The result is divided by the precision multiplier to remove numbers beyond
what we care about, then multiplied by the same precision multiplier to get the actual value
with truncated values past precision. So having a value of `15.235234324234512365 * 10^18`
with precision `2` would give us `15.230000000000000000 * 10^18`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| config | struct IZNSCurvePricer.CurvePriceConfig | The parent price config |
| length | uint256 | The length of the domain name |

