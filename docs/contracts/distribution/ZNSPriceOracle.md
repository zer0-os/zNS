## ZNSPriceOracle


**Implementation of the Price Oracle, module that calculates the price of a domain
based on its length and the rules set by Zero ADMIN.**






### PERCENTAGE_BASIS

```solidity
uint256 PERCENTAGE_BASIS
```


Value used as a basis for percentage calculations,
since Solidity does not support fractions.




### rootDomainPriceConfig

```solidity
struct IZNSPriceOracle.DomainPriceConfig rootDomainPriceConfig
```


Struct for each configurable price variable
that participates in the price calculation.

See [IZNSPriceOracle.md](./IZNSPriceOracle.md) for more details.



### feePercentage

```solidity
uint256 feePercentage
```


The registration fee value in percentage as basis points (parts per 10,000)
 so the 2% value would be represented as 200.
 See [getRegistrationFee](#getregistrationfee) for the actual fee calc process.




### initialize

```solidity
function initialize(address accessController_, struct IZNSPriceOracle.DomainPriceConfig priceConfig_, uint256 regFeePercentage_) public
```


Proxy initializer to set the initial state of the contract after deployment.
Only ADMIN can call this function.

> Note the for DomainPriceConfig we set each value individually and calling
2 important functions that validate all of the config's values against the formula:
- `setPrecisionMultiplier()` to validate precision multiplier
- `_validateConfig()` to validate the whole config in order to avoid price spikes

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | the address of the ZNSAccessController contract. |
| priceConfig_ | struct IZNSPriceOracle.DomainPriceConfig | a number of variables that participate in the price calculation. |
| regFeePercentage_ | uint256 | the registration fee value in percentage as basis points (parts per 10,000) |


### getPrice

```solidity
function getPrice(string name) external view returns (uint256 totalPrice, uint256 domainPrice, uint256 fee)
```


Get the price of a given domain name


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | string | The name of the domain to check |


### getRegistrationFee

```solidity
function getRegistrationFee(uint256 domainPrice) public view returns (uint256)
```


Get the registration fee amount in `stakingToken` for a specific domain price
as `domainPrice * feePercentage / PERCENTAGE_BASIS`.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainPrice | uint256 | The price of the domain |


### setPriceConfig

```solidity
function setPriceConfig(struct IZNSPriceOracle.DomainPriceConfig priceConfig) external
```


Setter for `rootDomainPriceConfig`. Only ADMIN can call this function.

Validates the value of the `precisionMultiplier` and the whole config in order to avoid price spikes,
fires `PriceConfigSet` event.
Only ADMIN can call this function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceConfig | struct IZNSPriceOracle.DomainPriceConfig | The new price config to set |


### setMaxPrice

```solidity
function setMaxPrice(uint256 maxPrice) external
```


Sets the max price for domains. Validates the config with the new price.
Fires `MaxPriceSet` event.
Only ADMIN can call this function.
> `maxPrice` can be set to 0 to make all domains free!


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| maxPrice | uint256 | The maximum price to set in $ZERO |


### setMinPrice

```solidity
function setMinPrice(uint256 minPrice) external
```


Sets the minimum price for domains. Validates the config with the new price.
Fires `MinPriceSet` event.
Only ADMIN can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| minPrice | uint256 | The minimum price to set in $ZERO |


### setBaseLength

```solidity
function setBaseLength(uint256 length) external
```


Set the value of the domain name length boundary where the `maxPrice` applies
e.g. A value of '5' means all domains <= 5 in length cost the `maxPrice` price
Validates the config with the new length. Fires `BaseLengthSet` event.
Only ADMIN can call this function.
> `baseLength` can be set to 0 to make all domains cost `maxPrice`!
> This indicates to the system that we are
> currently in a special phase where we define an exact price for all domains
> e.g. promotions or sales


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| length | uint256 | Boundary to set |


### setMaxLength

```solidity
function setMaxLength(uint256 length) external
```


Set the maximum length of a domain name to which price formula applies.
All domain names (labels) that are longer than this value will cost the fixed price of `minPrice`,
and the pricing formula will not apply to them.
Validates the config with the new length.
Fires `MaxLengthSet` event.
Only ADMIN can call this function.
> `maxLength` can be set to 0 to make all domains cost `minPrice`!


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| length | uint256 | The maximum length to set |


### setPrecisionMultiplier

```solidity
function setPrecisionMultiplier(uint256 multiplier) public
```


Sets the precision multiplier for the price calculation.
Multiplier This should be picked based on the number of token decimals
to calculate properly.
e.g. if we use a token with 18 decimals, and want precision of 2,
our precision multiplier will be equal to `10^(18 - 2) = 10^16`
Fires `PrecisionMultiplierSet` event.
Only ADMIN can call this function.
> Multiplier should be less or equal to 10^18 and greater than 0!


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| multiplier | uint256 | The multiplier to set |


### setRegistrationFeePercentage

```solidity
function setRegistrationFeePercentage(uint256 regFeePercentage) external
```


Sets the fee percentage for domain registration.

Fee percentage is set according to the basis of 10000, outlined in ``PERCENTAGE_BASIS``.
Fires ``FeePercentageSet`` event.
Only ADMIN can call this function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| regFeePercentage | uint256 | The fee percentage to set |


### setAccessController

```solidity
function setAccessController(address accessController_) external
```


Sets the access controller for the contract.
Only ADMIN can call this function.
Fires `AccessControllerSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the new access controller |


### getAccessController

```solidity
function getAccessController() external view returns (address)
```


Getter for ZNSAccessController address stored on this contract.




### _getPrice

```solidity
function _getPrice(uint256 length) internal view returns (uint256)
```


Internal function to calculate price based on the config set,
and the length of the domain label.

Before we calculate the price, 3 different cases are possible:
1. `baseLength` is 0, which means we are returning `maxPrice` as a specific price for all domains
2. `length` is less than or equal to `baseLength`, which means a domain will cost `maxPrice`
3. `length` is greater than `maxLength`, which means a domain will cost `minPrice`

The formula itself creates an asymptotic curve that decreases in pricing based on domain name length,
base length and max price, the result is divided by the precision multiplier to remove numbers beyond
what we care about, then multiplied by the same precision multiplier to get the actual value
with truncated values past precision. So having a value of `15.235234324234512365 * 10^18`
with precision `2` would give us `15.230000000000000000 * 10^18`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| length | uint256 | The length of the domain name |


### _validateConfig

```solidity
function _validateConfig() internal view
```


Internal function called every time we set props of `rootDomainPriceConfig`
to make sure that values being set can not disrupt the price curve or zero out prices
for domains. If this validation fails, function will revert.

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



