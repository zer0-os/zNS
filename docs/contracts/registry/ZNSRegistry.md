## ZNSRegistry


**The main reference data contract in ZNS. Also, often, the last contract
in the call chain of many operations where the most crucial Name owner data settles.
Owner of a domain in this contract also serves as the owner of the stake in `ZNSTreasury`.**






### records

```solidity
mapping(bytes32 => struct IZNSRegistry.DomainRecord) records
```


Mapping of `domainHash` to [DomainRecord](./IZNSRegistry.md#iznsregistry) struct to hold information
about each domain




### operators

```solidity
mapping(address => mapping(address => bool)) operators
```


Mapping of `owner` => `operator` => `bool` to show accounts that
are or aren't allowed access to domains that `owner` has access to.
Note that operators can NOT change the owner of the domain, but can change
the resolver or resolver records.




### onlyOwnerOrOperator

```solidity
modifier onlyOwnerOrOperator(bytes32 domainHash)
```


Revert if `msg.sender` is not the owner or an operator allowed by the owner


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |


### onlyOwner

```solidity
modifier onlyOwner(bytes32 domainHash)
```


Revert if `msg.sender` is not the owner. Used for owner restricted functions.




### onlyRegistrar

```solidity
modifier onlyRegistrar()
```


Revert if `msg.sender` is not the `ZNSRegistrar` contract
or an address holding REGISTRAR_ROLE.




### initialize

```solidity
function initialize(address accessController_) public
```


Initializer for the `ZNSRegistry` proxy.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the `ZNSAccessController` contract |


### exists

```solidity
function exists(bytes32 domainHash) external view returns (bool)
```


Checks if a given domain exists


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of a domain's name |


### isOwnerOrOperator

```solidity
function isOwnerOrOperator(bytes32 domainHash, address candidate) public view returns (bool)
```


Checks if provided address is an owner or an operator of the provided domain


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of a domain's name |
| candidate | address | The address for which we are checking access |


### setOwnerOperator

```solidity
function setOwnerOperator(address operator, bool allowed) external
```


Set an `operator` as `allowed` to give or remove permissions for ALL
domains owned by the owner `msg.sender`.
Emits an `OperatorPermissionSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The account to allow/disallow |
| allowed | bool | The true/false value to set |


### getDomainRecord

```solidity
function getDomainRecord(bytes32 domainHash) external view returns (struct IZNSRegistry.DomainRecord)
```


Gets a record for a domain (owner, resolver) from the internal mapping
`records`. `records` maps a domain hash to a
[DomainRecord](./IZNSRegistry.md#iznsregistry) struct.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |


### getDomainOwner

```solidity
function getDomainOwner(bytes32 domainHash) external view returns (address)
```


Gets the owner of the given domain


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |


### getDomainResolver

```solidity
function getDomainResolver(bytes32 domainHash) external view returns (address)
```


Gets the resolver set for the given domain.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |


### createDomainRecord

```solidity
function createDomainRecord(bytes32 domainHash, address owner, address resolver) external
```


Creates a new domain record. Only callable by the `ZNSRegistrar`
or an address that has REGISTRAR_ROLE. This is one of the last calls in the Register
flow that starts from `ZNSRegistrar.registerDomain()`. Calls 2 internal functions to set
the owner and resolver of the domain separately.
Can be called with `resolver` param as 0, which will exclude the call to set resolver.
Emits `DomainOwnerSet` and possibly `DomainResolverSet` events.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain name |
| owner | address | The owner of the new domain |
| resolver | address | The resolver of the new domain, can be 0 |


### updateDomainRecord

```solidity
function updateDomainRecord(bytes32 domainHash, address owner, address resolver) external
```


Updates an existing domain record's owner and resolver.
Note that this function can ONLY be called by the Name owner of the domain.
This is NOT used by the `ZNSRegistrar` contract and serves as a user facing function
for the owners of existing domains to change their data on this contract. A domain
`operator` can NOT call this, since he is not allowed to change the owner.
Emits `DomainOwnerSet` and `DomainResolverSet` events.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain |
| owner | address | The owner or an allowed operator of that domain |
| resolver | address | The resolver for the domain |


### updateDomainOwner

```solidity
function updateDomainOwner(bytes32 domainHash, address owner) external
```


Updates the owner of an existing domain. Can be called by either the Name owner
on this contract OR the `ZNSRegistrar` contract as part of the Reclaim flow
that starts at `ZNSRegistrar.reclaim()`. Emits an `DomainOwnerSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| owner | address | The account to transfer ownership to |


### updateDomainResolver

```solidity
function updateDomainResolver(bytes32 domainHash, address resolver) external
```


Updates the resolver of an existing domain in `records`.
Can be called by eithe the owner of the Name or an allowed operator.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| resolver | address | The new Resolver contract address |


### deleteRecord

```solidity
function deleteRecord(bytes32 domainHash) external
```


Deletes a domain's record from this contract's state.
This can ONLY be called by the `ZNSRegistrar` contract as part of the Revoke flow
or any address holding the `REGISTRAR_ROLE`. Emits a `DomainRecordDeleted` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain name |


### setAccessController

```solidity
function setAccessController(address accessController) external
```


Sets the `accessController` contract


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController | address | The new access controller |


### getAccessController

```solidity
function getAccessController() external view returns (address)
```


Gets the `accessController` from state.




### _exists

```solidity
function _exists(bytes32 domainHash) internal view returns (bool)
```


Check if a domain exists. True if the owner is not `0x0`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |


### _setDomainOwner

```solidity
function _setDomainOwner(bytes32 domainHash, address owner) internal
```


Internal function to set a domain's owner in state `records`.
Owner can NOT be set to 0, since we use delete operation as part of the
``deleteRecord()`` function.
Emits a `DomainOwnerSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| owner | address | The owner to set |


### _setDomainResolver

```solidity
function _setDomainResolver(bytes32 domainHash, address resolver) internal
```


Internal function to set a domain's resolver in state `records`.
Resolver can be set to 0, since we allow partial domain data. Emits a `DomainResolverSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| resolver | address | The resolver to set |


### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |



