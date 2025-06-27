## IZNSRegistry

The `DomainRecord` struct is meant to hold relevant information
about a domain, such as its owner and resolver.
- `owner` (address): The owner of the domain (also called the owner of the Name).
- `resolver` (address): The address of the Resolver contract where this domain's source records are stored.

### DomainRecord

Description of a domain record, pointing to the
owner address of that record as well as the address of
its resolver

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

Emits when ownership of a domain is modified in `records`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | the hash of a domain's name |
| owner | address | The new domain owner |

### DomainResolverSet

```solidity
event DomainResolverSet(bytes32 domainHash, address resolver)
```

Emit when a domain's resolver is modified in `records`

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

### ResolverAdded

```solidity
event ResolverAdded(string resolverType, address resolver)
```

Emitted when a new resolver type is added to ZNS

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| resolverType | string | The name of the resolver type |
| resolver | address | The address of the resolver contract |

### ResolverDeleted

```solidity
event ResolverDeleted(string resolverType)
```

Emitted when a resolver is deleted from ZNS

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| resolverType | string | The name of the resolver type |

### initialize

```solidity
function initialize(address accessController) external
```

### exists

```solidity
function exists(bytes32 domainHash) external view returns (bool)
```

### isOwnerOrOperator

```solidity
function isOwnerOrOperator(bytes32 domainHash, address candidate) external view returns (bool)
```

### isOperatorFor

```solidity
function isOperatorFor(address operator, address owner) external view returns (bool)
```

### setOwnersOperator

```solidity
function setOwnersOperator(address operator, bool allowed) external
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

### getDomainOwner

```solidity
function getDomainOwner(bytes32 domainHash) external view returns (address)
```

### getDomainResolver

```solidity
function getDomainResolver(bytes32 domainHash) external view returns (address)
```

### createDomainRecord

```solidity
function createDomainRecord(bytes32 domainHash, address owner, string resolverType) external
```

### getResolverType

```solidity
function getResolverType(string resolverType) external returns (address)
```

### addResolverType

```solidity
function addResolverType(string resolverType, address resolver) external
```

### deleteResolverType

```solidity
function deleteResolverType(string resolverType) external
```

### updateDomainRecord

```solidity
function updateDomainRecord(bytes32 domainHash, address owner, string resolverType) external
```

### updateDomainOwner

```solidity
function updateDomainOwner(bytes32 domainHash, address owner) external
```

### updateDomainResolver

```solidity
function updateDomainResolver(bytes32 domainHash, string resolverType) external
```

### deleteRecord

```solidity
function deleteRecord(bytes32 domainHash) external
```

