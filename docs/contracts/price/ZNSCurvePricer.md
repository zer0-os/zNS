## ZNSCurvePricer

**Implementation of the Curve Pricing, module that calculates the price of a domain
based on its length and the rules set by Zero ADMIN.
This module uses an asymptotic curve that starts from `maxPrice` for all domains <= `baseLength`.
It then decreases in price, using the calculated price function below, until it reaches `minPrice`
at `maxLength` length of the domain name. Price after `maxLength` is fixed and always equal to `minPrice`.**

### PERCENTAGE_BASIS

```solidity
uint256 PERCENTAGE_BASIS
```

Value used as a basis for percentage calculations,
since Solidity does not support fractions.

### priceConfigs

```solidity
mapping(bytes32 => struct ICurvePriceConfig.CurvePriceConfig) priceConfigs
```

Mapping of domainHash to the price config for that domain set by the parent domain owner.

Zero, for pricing root domains, uses this mapping as well under 0x0 hash.

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address accessController_, address registry_, struct ICurvePriceConfig.CurvePriceConfig zeroPriceConfig_) external
```

Proxy initializer to set the initial state of the contract after deployment.
Only Owner of the 0x0 hash (Zero owned address) can call this function.

> Note the for PriceConfig we set each value individually and calling
2 important functions that validate all of the config's values against the formula:
- `setPrecisionMultiplier()` to validate precision multiplier
- `_validateConfig()` to validate the whole config in order to avoid price spikes

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | the address of the ZNSAccessController contract. |
| registry_ | address | the address of the ZNSRegistry contract. |
| zeroPriceConfig_ | struct ICurvePriceConfig.CurvePriceConfig | a number of variables that participate in the price calculation for subdomains. |

### getPrice

```solidity
function getPrice(bytes32 parentHash, string label, bool skipValidityCheck) public view returns (uint256)
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
| parentHash | bytes32 | The hash of the parent domain under which price is determined |
| label | string | The label of the subdomain candidate to get the price for before/during registration |
| skipValidityCheck | bool | If true, skips the validity check for the label |

### getFeeForPrice

```solidity
function getFeeForPrice(bytes32 parentHash, uint256 price) public view returns (uint256)
```

Part of the IZNSPricer interface - one of the functions required
for any pricing contracts used with ZNS. It returns fee for a given price
based on the value set by the owner of the parent domain.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentHash | bytes32 | The hash of the parent domain under which fee is determined |
| price | uint256 | The price to get the fee for |

### getPriceAndFee

```solidity
function getPriceAndFee(bytes32 parentHash, string label, bool skipValidityCheck) external view returns (uint256 price, uint256 stakeFee)
```

Part of the IZNSPricer interface - one of the functions required
for any pricing contracts used with ZNS. Returns both price and fee for a given label
under the given parent.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentHash | bytes32 | The hash of the parent domain under which price and fee are determined |
| label | string | The label of the subdomain candidate to get the price and fee for before/during registration |
| skipValidityCheck | bool |  |

### setPriceConfig

```solidity
function setPriceConfig(bytes32 domainHash, struct ICurvePriceConfig.CurvePriceConfig priceConfig) public
```

Setter for `priceConfigs[domainHash]`. Only domain owner/operator can call this function.

Validates the value of the `precisionMultiplier` and the whole config in order to avoid price spikes,
fires `PriceConfigSet` event.
Only the owner of the domain or an allowed operator can call this function
> This function should ALWAYS be used to set the config, since it's the only place where `isSet` is set to true.
> Use the other individual setters to modify only, since they do not set this variable!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the price config for |
| priceConfig | struct ICurvePriceConfig.CurvePriceConfig | The new price config to set |

### setMaxPrice

```solidity
function setMaxPrice(bytes32 domainHash, uint256 maxPrice) external
```

Sets the max price for domains. Validates the config with the new price.
Fires `MaxPriceSet` event.
Only domain owner can call this function.
> `maxPrice` can be set to 0 along with `baseLength` or `minPrice` to make all domains free!

We are checking here for possible price spike at `maxLength` if the `maxPrice` values is NOT 0.
In the case of 0 we do not validate, since setting it to 0 will make all subdomains free.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| maxPrice | uint256 | The maximum price to set |

### setMinPrice

```solidity
function setMinPrice(bytes32 domainHash, uint256 minPrice) external
```

Sets the minimum price for domains. Validates the config with the new price.
Fires `MinPriceSet` event.
Only domain owner/operator can call this function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the `minPrice` for |
| minPrice | uint256 | The minimum price to set in $ZERO |

### setBaseLength

```solidity
function setBaseLength(bytes32 domainHash, uint256 length) external
```

Set the value of the domain name length boundary where the `maxPrice` applies
e.g. A value of '5' means all domains <= 5 in length cost the `maxPrice` price
Validates the config with the new length. Fires `BaseLengthSet` event.
Only domain owner/operator can call this function.
> `baseLength` can be set to 0 to make all domains cost `maxPrice`!
> This indicates to the system that we are
> currently in a special phase where we define an exact price for all domains
> e.g. promotions or sales

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the `baseLength` for |
| length | uint256 | Boundary to set |

### setMaxLength

```solidity
function setMaxLength(bytes32 domainHash, uint256 length) external
```

Set the maximum length of a domain name to which price formula applies.
All domain names (labels) that are longer than this value will cost the fixed price of `minPrice`,
and the pricing formula will not apply to them.
Validates the config with the new length.
Fires `MaxLengthSet` event.
Only domain owner/operator can call this function.
> `maxLength` can be set to 0 to make all domains cost `minPrice`!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the `maxLength` for |
| length | uint256 | The maximum length to set |

### setPrecisionMultiplier

```solidity
function setPrecisionMultiplier(bytes32 domainHash, uint256 multiplier) public
```

Sets the precision multiplier for the price calculation.
Multiplier This should be picked based on the number of token decimals
to calculate properly.
e.g. if we use a token with 18 decimals, and want precision of 2,
our precision multiplier will be equal to `10^(18 - 2) = 10^16`
Fires `PrecisionMultiplierSet` event.
Only domain owner/operator can call this function.
> Multiplier should be less or equal to 10^18 and greater than 0!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 |  |
| multiplier | uint256 | The multiplier to set |

### setFeePercentage

```solidity
function setFeePercentage(bytes32 domainHash, uint256 feePercentage) public
```

Sets the fee percentage for domain registration.

Fee percentage is set according to the basis of 10000, outlined in `PERCENTAGE_BASIS`.
Fires `FeePercentageSet` event.
Only domain owner/operator can call this function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the fee percentage for |
| feePercentage | uint256 | The fee percentage to set |

### setRegistry

```solidity
function setRegistry(address registry_) external
```

Sets the registry address in state.

This function is required for all contracts inheriting `ARegistryWired`.

### _getPrice

```solidity
function _getPrice(bytes32 parentHash, uint256 length) internal view returns (uint256)
```

Internal function to calculate price based on the config set,
and the length of the domain label.

Before we calculate the price, 4 different cases are possible:
1. `maxPrice` is 0, which means all subdomains under this parent are free
2. `baseLength` is 0, which means we are returning `maxPrice` as a specific price for all domains
3. `length` is less than or equal to `baseLength`, which means a domain will cost `maxPrice`
4. `length` is greater than `maxLength`, which means a domain will cost `minPrice`

The formula itself creates an asymptotic curve that decreases in pricing based on domain name length,
base length and max price, the result is divided by the precision multiplier to remove numbers beyond
what we care about, then multiplied by the same precision multiplier to get the actual value
with truncated values past precision. So having a value of `15.235234324234512365 * 10^18`
with precision `2` would give us `15.230000000000000000 * 10^18`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentHash | bytes32 |  |
| length | uint256 | The length of the domain name |

### _validateConfig

```solidity
function _validateConfig(bytes32 domainHash) internal view
```

Internal function called every time we set props of `priceConfigs[domainHash]`
to make sure that values being set can not disrupt the price curve or zero out prices
for domains. If this validation fails, the parent function will revert.

We are checking here for possible price spike at `maxLength`
which can occur if some of the config values are not properly chosen and set.

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```

To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The new implementation contract to upgrade to. |

