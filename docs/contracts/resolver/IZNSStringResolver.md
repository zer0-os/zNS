## IZNSStringResolver

### StringSet

```solidity
event StringSet(bytes32 domainHash, string newString)
```

Emitted when string resolution value is set for a domain.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The identifying hash of a domain's name |
| newString | string | - content of string type set by the owner/operator to which a domain will resolve to |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```

### resolveDomainString

```solidity
function resolveDomainString(bytes32 domainHash) external view returns (string)
```

### setString

```solidity
function setString(bytes32 domainHash, string newString) external
```

### getInterfaceId

```solidity
function getInterfaceId() external pure returns (bytes4)
```

### setRegistry

```solidity
function setRegistry(address _registry) external
```

### initialize

```solidity
function initialize(address _accessController, address _registry) external
```

