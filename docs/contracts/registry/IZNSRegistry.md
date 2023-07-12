## IZNSRegistry



The `DomainRecord` struct is meant to hold relevant information
about a domain, such as its owner and resolver.
- `owner` (address): The owner of the domain (also called the owner of the Name).
- `resolver` (address): The address of the Resolver contract where this domain's source records are stored.

In the future, there will be multiple Resolver contracts that support different types of sources.
Currently, only the `ZNSAddressResolver` is implemented.




### DomainRecord








```solidity
struct DomainRecord {
  address owner;
  address resolver;
}
```

### DomainOwnerSet

```solidity
event DomainOwnerSet(bytes32 domainHash, address owner)
```


Emits when ownership of a domain is modified in ``records``


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| owner | address | The new domain owner |


### DomainResolverSet

```solidity
event DomainResolverSet(bytes32 domainHash, address resolver)
```


Emit when a domain's resolver is modified in ``records``


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| resolver | address | The new resolver address |


### DomainRecordDeleted

```solidity
event DomainRecordDeleted(bytes32 domainHash)
```


Emits when a domain record is deleted


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of a domain's name |


### OperatorPermissionSet

```solidity
event OperatorPermissionSet(address owner, address operator, bool allowed)
```


Emit when an owner allows/disallows permissions for an operator


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | Owner of the domain in question |
| operator | address | Address that was allowed/disallowed |
| allowed | bool | Boolean status of their permission |


### initialize

```solidity
function initialize(address accessController) external
```


Create an instance of the ZNSRegistry contract


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController | address | The addrss of the access controller |


### exists

```solidity
function exists(bytes32 domainHash) external view returns (bool)
```


Check if a given domain exists


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of a domain's name |


### isOwnerOrOperator

```solidity
function isOwnerOrOperator(bytes32 domainHash, address candidate) external view returns (bool)
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


Set an `operator` as `allowed` to give or remove permissions for all
domains owned by `msg.sender`


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The account to allow/disallow |
| allowed | bool | The true/false value to set |


### getDomainRecord

```solidity
function getDomainRecord(bytes32 domainHash) external view returns (struct IZNSRegistry.DomainRecord)
```


Get a record for a domain


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |


### getDomainOwner

```solidity
function getDomainOwner(bytes32 domainHash) external view returns (address)
```


Get the owner of the given domain


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |


### getDomainResolver

```solidity
function getDomainResolver(bytes32 domainHash) external view returns (address)
```


Get the default resolver for the given domain


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of a domain's name |


### createDomainRecord

```solidity
function createDomainRecord(bytes32 domainHash, address owner, address resolver) external
```


Create a new domain record


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain name |
| owner | address | The owner of the new domain |
| resolver | address | The resolver of the new domain |


### updateDomainRecord

```solidity
function updateDomainRecord(bytes32 domainHash, address owner, address resolver) external
```


Update an existing domain record's owner or resolver


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


Update a domain's owner


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| owner | address | The account to transfer ownership to |


### updateDomainResolver

```solidity
function updateDomainResolver(bytes32 domainHash, address resolver) external
```


Update the domain's default resolver


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| resolver | address | The new default resolver |


### deleteRecord

```solidity
function deleteRecord(bytes32 domainHash) external
```


Delete a domain's record


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain name |


### setAccessController

```solidity
function setAccessController(address accessController) external
```


Set the access controller contract


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController | address | The new access controller |


### getAccessController

```solidity
function getAccessController() external view returns (address)
```


Get the access controller contract





