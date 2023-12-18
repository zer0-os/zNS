## IZNSAddressResolver

### AddressSet

```solidity
event AddressSet(bytes32 domainHash, address newAddress)
```

Emit when ownership of a domain is modified

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The identifying hash of a domain's name |
| newAddress | address | The new domain owner |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```

### resolveDomainAddress

```solidity
function resolveDomainAddress(bytes32 domainHash) external view returns (address)
```

### setAddress

```solidity
function setAddress(bytes32 domainHash, address newAddress) external
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

