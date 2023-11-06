## ZNSSubRegistrar


**ZNSSubRegistrar.sol - The contract for registering and revoking subdomains of zNS.**



This contract has the entry point for registering subdomains, but calls
the ZNSRootRegistrar back to finalize registration. Common logic for domains
of any level is in the `ZNSRootRegistrar.coreRegister()`.



### rootRegistrar

```solidity
contract IZNSRootRegistrar rootRegistrar
```


State var for the ZNSRootRegistrar contract that finalizes registration of subdomains.




### distrConfigs

```solidity
mapping(bytes32 => struct IDistributionConfig.DistributionConfig) distrConfigs
```


Mapping of domainHash to distribution config set by the domain owner/operator.
These configs are used to determine how subdomains are distributed for every parent.

Note that the rules outlined in the DistributionConfig are only applied to direct children!



### Mintlist








```solidity
struct Mintlist {
  mapping(uint256 => mapping(address => bool)) list;
  uint256 ownerIndex;
}
```

### mintlist

```solidity
mapping(bytes32 => struct ZNSSubRegistrar.Mintlist) mintlist
```


Mapping of domainHash to mintlist set by the domain owner/operator.
These configs are used to determine who can register subdomains for every parent
in the case where parent's DistributionConfig.AccessType is set to AccessType.MINTLIST.




### onlyOwnerOperatorOrRegistrar

```solidity
modifier onlyOwnerOperatorOrRegistrar(bytes32 domainHash)
```







### constructor

```solidity
constructor() public
```







### initialize

```solidity
function initialize(address _accessController, address _registry, address _rootRegistrar) external
```







### registerSubdomain

```solidity
function registerSubdomain(bytes32 parentHash, string label, address domainAddress, string tokenURI, struct IDistributionConfig.DistributionConfig distrConfig) external returns (bytes32)
```


Entry point to register a subdomain under a parent domain specified.

Reads the `DistributionConfig` for the parent domain to determine how to distribute,
checks if the sender is allowed to register, check if subdomain is available,
acquires the price and other data needed to finalize the registration
and calls the `ZNSRootRegistrar.coreRegister()` to finalize.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentHash | bytes32 | The hash of the parent domain to register the subdomain under |
| label | string | The label of the subdomain to register (e.g. in 0://zero.child the label would be "child"). |
| domainAddress | address | (optional) The address to which the subdomain will be resolved to |
| tokenURI | string | (required) The tokenURI for the subdomain to be registered |
| distrConfig | struct IDistributionConfig.DistributionConfig | (optional) The distribution config to be set for the subdomain to set rules for children |


### hashWithParent

```solidity
function hashWithParent(bytes32 parentHash, string label) public pure returns (bytes32)
```


Helper function to hash a child label with a parent domain hash.




### setDistributionConfigForDomain

```solidity
function setDistributionConfigForDomain(bytes32 domainHash, struct IDistributionConfig.DistributionConfig config) public
```


Setter for `distrConfigs[domainHash]`.
Only domain owner/operator or ZNSRootRegistrar can call this function.

This config can be changed by the domain owner/operator at any time or be set
after registration if the config was not provided during the registration.
Fires `DistributionConfigSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the distribution config for |
| config | struct IDistributionConfig.DistributionConfig | The new distribution config to set (for config fields see `IDistributionConfig.sol`) |


### setPricerContractForDomain

```solidity
function setPricerContractForDomain(bytes32 domainHash, contract IZNSPricer pricerContract) public
```


One of the individual setters for `distrConfigs[domainHash]`. Sets `pricerContract` field of the struct.
Made to be able to set the pricer contract for a domain without setting the whole config.
Only domain owner/operator can call this function.
Fires `PricerContractSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the pricer contract for |
| pricerContract | contract IZNSPricer | The new pricer contract to set |


### setPaymentTypeForDomain

```solidity
function setPaymentTypeForDomain(bytes32 domainHash, enum IDistributionConfig.PaymentType paymentType) public
```


One of the individual setters for `distrConfigs[domainHash]`. Sets `paymentType` field of the struct.
Made to be able to set the payment type for a domain without setting the whole config.
Only domain owner/operator can call this function.
Fires `PaymentTypeSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the payment type for |
| paymentType | enum IDistributionConfig.PaymentType | The new payment type to set |


### setAccessTypeForDomain

```solidity
function setAccessTypeForDomain(bytes32 domainHash, enum IDistributionConfig.AccessType accessType) public
```


One of the individual setters for `distrConfigs[domainHash]`. Sets `accessType` field of the struct.
Made to be able to set the access type for a domain without setting the whole config.
Only domain owner/operator or ZNSRootRegistrar can call this function.
Fires `AccessTypeSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the access type for |
| accessType | enum IDistributionConfig.AccessType | The new access type to set |


### updateMintlistForDomain

```solidity
function updateMintlistForDomain(bytes32 domainHash, address[] candidates, bool[] allowed) external
```


Setter for `mintlist[domainHash][candidate]`. Only domain owner/operator can call this function.
Adds or removes candidates from the mintlist for a domain. Should only be used when the domain's owner
wants to limit subdomain registration to a specific set of addresses.
Can be used to add/remove multiple candidates at once. Can only be called by the domain owner/operator.
Fires `MintlistUpdated` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the mintlist for |
| candidates | address[] | The array of candidates to add/remove |
| allowed | bool[] | The array of booleans indicating whether to add or remove the candidate |


### isMintlistedForDomain

```solidity
function isMintlistedForDomain(bytes32 domainHash, address candidate) external view returns (bool)
```







### clearMintlistForDomain

```solidity
function clearMintlistForDomain(bytes32 domainHash) public
```







### clearMintlistAndLock

```solidity
function clearMintlistAndLock(bytes32 domainHash) external
```







### setRegistry

```solidity
function setRegistry(address registry_) public
```


Sets the registry address in state.

This function is required for all contracts inheriting `ARegistryWired`.



### setRootRegistrar

```solidity
function setRootRegistrar(address registrar_) public
```


Setter for `rootRegistrar`. Only admin can call this function.
Fires `RootRegistrarSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| registrar_ | address | The new address of the ZNSRootRegistrar contract |


### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |



