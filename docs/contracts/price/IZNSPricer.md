## IZNSPricer

**IZNSPricer.sol**

Base interface required to be inherited by all Pricing contracts to work with zNS

### IncorrectPriceConfigLength

```solidity
error IncorrectPriceConfigLength()
```

Emitted when the given price config is not the expected length

### FeePercentageValueTooLarge

```solidity
error FeePercentageValueTooLarge(uint256 feePercentage, uint256 maximum)
```

Reverted when domain owner is trying to set it's stake fee percentage
higher than 100% (uint256 "10,000").

### getPrice

```solidity
function getPrice(bytes parentPriceConfig, string label, bool skipValidityCheck) external pure returns (uint256)
```

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
| parentPriceConfig | bytes | The abi encoded price config of the parent domain under which price is determined  This stored somewhere else (e.g. SubRegistrar) and passed here, since Pricer contracts are stateless. |
| label | string | The label of the subdomain candidate to get the price for. Only used in pricers  where price depends on the label length. |
| skipValidityCheck | bool | If "true", skips the validity check for the label, if "false" will fail  for invalid labels. |

### getPriceAndFee

```solidity
function getPriceAndFee(bytes parentPriceConfig, string label, bool skipValidityCheck) external pure returns (uint256 price, uint256 fee)
```

Fees are only supported for `PaymentType.STAKE` !
 This function will NOT be called if `PaymentType` != `PaymentType.STAKE`
 Instead `getPrice()` will be called.

### getFeeForPrice

```solidity
function getFeeForPrice(bytes parentPriceConfig, uint256 price) external pure returns (uint256)
```

Returns the fee for a given price and parent price config.

Fees are only supported for `PaymentType.STAKE` !

### validatePriceConfig

```solidity
function validatePriceConfig(bytes priceConfig) external pure
```

Validate a given encoded price config before storing it somewhere.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceConfig | bytes | The price config to validate |

