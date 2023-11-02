## ZNSFixedPricer



Pricer contract that uses the most straightforward fixed pricing model
that doesn't depend on the length of the label.




### PERCENTAGE_BASIS

```solidity
uint256 PERCENTAGE_BASIS
```







### priceConfigs

```solidity
mapping(bytes32 => struct IZNSFixedPricer.PriceConfig) priceConfigs
```


Mapping of domainHash to price config set by the domain owner/operator




### constructor

```solidity
constructor() public
```







### initialize

```solidity
function initialize(address _accessController, address _registry) external
```







### setPrice

```solidity
function setPrice(bytes32 domainHash, uint256 _price) public
```


Sets the price for a domain. Only callable by domain owner/operator. Emits a `PriceSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain who sets the price for subdomains |
| _price | uint256 | The new price value set |


### getPrice

```solidity
function getPrice(bytes32 parentHash, string label, bool skipValidityCheck) public view returns (uint256)
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
| parentHash | bytes32 | The hash of the parent domain to check the price under |
| label | string | The label of the subdomain candidate to check the price for |
| skipValidityCheck | bool | If true, skips the validity check for the label |


### setFeePercentage

```solidity
function setFeePercentage(bytes32 domainHash, uint256 feePercentage) public
```


Sets the feePercentage for a domain. Only callable by domain owner/operator.
Emits a `FeePercentageSet` event.

`feePercentage` is set as a part of the `PERCENTAGE_BASIS` of 10,000 where 1% = 100

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain who sets the feePercentage for subdomains |
| feePercentage | uint256 | The new feePercentage value set |


### setPriceConfig

```solidity
function setPriceConfig(bytes32 domainHash, struct IZNSFixedPricer.PriceConfig priceConfig) external
```


Setter for `priceConfigs[domainHash]`. Only domain owner/operator can call this function.

Sets both `PriceConfig.price` and `PriceConfig.feePercentage` in one call, fires `PriceSet`
and `FeePercentageSet` events.
> This function should ALWAYS be used to set the config, since it's the only place where `isSet` is set to true.
> Use the other individual setters to modify only, since they do not set this variable!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the price config for |
| priceConfig | struct IZNSFixedPricer.PriceConfig | The new price config to set |


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
function getPriceAndFee(bytes32 parentHash, string label, bool skipValidityCheck) external view returns (uint256 price, uint256 fee)
```


Part of the IZNSPricer interface - one of the functions required
for any pricing contracts used with ZNS. Returns both price and fee for a given label
under the given parent.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentHash | bytes32 | The hash of the parent domain under which price and fee are determined |
| label | string | The label of the subdomain candidate to get the price and fee for before/during registration |
| skipValidityCheck | bool | If true, skips the validity check for the label |


### setRegistry

```solidity
function setRegistry(address registry_) public
```


Sets the registry address in state.

This function is required for all contracts inheriting `ARegistryWired`.



### _setPrice

```solidity
function _setPrice(bytes32 domainHash, uint256 price) internal
```


Internal function for set price


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain |
| price | uint256 | The new price |


### _setFeePercentage

```solidity
function _setFeePercentage(bytes32 domainHash, uint256 feePercentage) internal
```


Internal function for setFeePercentage


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain |
| feePercentage | uint256 | The new feePercentage |


### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The new implementation contract to upgrade to. |



