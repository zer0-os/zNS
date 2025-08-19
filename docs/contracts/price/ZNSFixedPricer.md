## ZNSFixedPricer

Pricer contract that uses the most straightforward fixed pricing model
that doesn't depend on the length of the label.

### PERCENTAGE_BASIS

```solidity
uint256 PERCENTAGE_BASIS
```

### encodeConfig

```solidity
function encodeConfig(struct IZNSFixedPricer.FixedPriceConfig config) external pure returns (bytes)
```

Real encoding happens off chain, but we keep this here as a
helper function for users to ensure that their data is correct

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| config | struct IZNSFixedPricer.FixedPriceConfig | The price to encode |

### decodePriceConfig

```solidity
function decodePriceConfig(bytes priceConfig) public pure returns (struct IZNSFixedPricer.FixedPriceConfig)
```

Decodes the price config from bytes to FixedPriceConfig struct

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceConfig | bytes | The bytes to decode |

### getPrice

```solidity
function getPrice(bytes parentPriceConfig, string label, bool skipValidityCheck) public pure returns (uint256)
```

Gets the price for a subdomain candidate label under the parent domain.

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
| parentPriceConfig | bytes | The hash of the parent domain to check the price under |
| label | string | The label of the subdomain candidate to check the price for |
| skipValidityCheck | bool | If true, skips the validity check for the label |

### validatePriceConfig

```solidity
function validatePriceConfig(bytes priceConfig) external pure
```

Verify that the given price config is valid for this pricer

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceConfig | bytes | The price config to validate |

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
| price | uint256 | The price for a domain |

### getPriceAndFee

```solidity
function getPriceAndFee(bytes parentPriceConfig, string, bool) external pure returns (uint256 price, uint256 fee)
```

Part of the IZNSPricer interface - one of the functions required
for any pricing contracts used with ZNS. Returns both price and fee for a given label
under the given parent.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentPriceConfig | bytes | The price config of the parent domain under which price and fee are determined |
|  | string |  |
|  | bool |  |

### _checkLength

```solidity
function _checkLength(bytes priceConfig) internal pure
```

### _getFeeForPrice

```solidity
function _getFeeForPrice(uint256 feePercentage, uint256 price) internal pure returns (uint256)
```

