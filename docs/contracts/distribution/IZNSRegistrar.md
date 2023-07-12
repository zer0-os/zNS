## IZNSRegistrar








### DomainRegistered

```solidity
event DomainRegistered(bytes32 domainHash, uint256 tokenId, string name, address registrant, address resolver, address domainAddress)
```


Emitted when a NEW domain is registered.

`domainAddress` parameter is the address to which a domain name will relate to in ZNS.
E.g. if a user made a domain for his wallet, the address of the wallet will be the `domainAddress`.
This can be 0 as this variable is not required to perform registration process
and can be set at a later time by the domain owner.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain registered |
| tokenId | uint256 | The tokenId of the domain registered |
| name | string | The name as string of the domain registered |
| registrant | address | The address that called `ZNSRegistrar.registerDomain()` |
| resolver | address | The resolver contract address of the domain registered |
| domainAddress | address | The domain address of the domain registered |


### DomainRevoked

```solidity
event DomainRevoked(bytes32 domainHash, address registrant)
```


Emitted when a domain is revoked.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain revoked |
| registrant | address | The address that called `ZNSRegistrar.revokeDomain()` |


### DomainReclaimed

```solidity
event DomainReclaimed(bytes32 domainHash, address registrant)
```


Emitted when an ownership of the Name is reclaimed by the Token owner.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain reclaimed |
| registrant | address | The address that called `ZNSRegistrar.reclaimDomain()` |


### RegistrySet

```solidity
event RegistrySet(address registry)
```


Emitted when the `registry` address is set in state.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| registry | address | The new address of the registry contract |


### TreasurySet

```solidity
event TreasurySet(address treasury)
```


Emitted when the `treasury` address is set in state.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| treasury | address | The new address of the treasury contract |


### DomainTokenSet

```solidity
event DomainTokenSet(address domainToken)
```


Emitted when the `domainToken` address is set in state.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainToken | address | The new address of the domainToken contract |


### AddressResolverSet

```solidity
event AddressResolverSet(address addressResolver)
```


Emitted when the `addressResolver` address is set in state.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressResolver | address | The new address of the addressResolver contract |


### registerDomain

```solidity
function registerDomain(string name, address resolverContent) external returns (bytes32)
```







### revokeDomain

```solidity
function revokeDomain(bytes32 domainHash) external
```







### reclaimDomain

```solidity
function reclaimDomain(bytes32 domainHash) external
```







### setRegistry

```solidity
function setRegistry(address registry_) external
```







### setTreasury

```solidity
function setTreasury(address treasury_) external
```







### setDomainToken

```solidity
function setDomainToken(address domainToken_) external
```







### setAddressResolver

```solidity
function setAddressResolver(address addressResolver_) external
```







### setAccessController

```solidity
function setAccessController(address accessController_) external
```







### getAccessController

```solidity
function getAccessController() external view returns (address)
```







### initialize

```solidity
function initialize(address accessController_, address registry_, address treasury_, address domainToken_, address addressResolver_) external
```








