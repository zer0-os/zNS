## ZNSStringResolver

**The specific Resolver for ZNS that maps domain hashes to strings.**

This Resolver supports ONLY the string type.

### resolvedStrings

```solidity
mapping(bytes32 => string) resolvedStrings
```

Mapping of domain hash to string used to bind domains
to any kinds of text.

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address accessController_, address registry_) external
```

Initializer for the `ZNSStringResolver` proxy.
Note that setter functions are used instead of direct state variable assignments
to use access control at deploy time. Only ADMIN can call this function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the `ZNSAccessController` contract |
| registry_ | address | The address of the `ZNSRegistry` contract |

### resolveDomainString

```solidity
function resolveDomainString(bytes32 domainHash) external view returns (string)
```

Returns string associated with a given domain name hash.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The identifying hash of a domain's name |

### setString

```solidity
function setString(bytes32 domainHash, string newString) external
```

Sets the string for a domain name hash.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The identifying hash of a domain's name |
| newString | string | The new string to map the domain to |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

ERC-165 check for implementation identifier
Supports interfaces `IZNSStringResolver` and `IERC165`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| interfaceId | bytes4 | ID to check, XOR of the first 4 bytes of each function signature |

### getInterfaceId

```solidity
function getInterfaceId() public pure returns (bytes4)
```

Exposes IZNSStringResolver interfaceId

### setRegistry

```solidity
function setRegistry(address _registry) public
```

Sets the address of the `ZNSRegistry` contract that holds all crucial data
for every domain in the system. This function can only be called by the ADMIN.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _registry | address | The address of the `ZNSRegistry` contract |

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```

To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |

