## ZNSAddressResolver

**The specific Resolver for ZNS that maps domain hashes to Ethereum addresses these domains were made for.**

This Resolver supports ONLY the address type. Every domain in ZNS made for a contract or wallet address
will have a corresponding record in this Resolver.

### domainAddresses

```solidity
mapping(bytes32 => address) domainAddresses
```

Mapping of domain hash to address used to bind domains
to wallet, contract or any other addresses.

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address accessController_, address registry_) external
```

Initializer for the `ZNSAddressResolver` proxy.
Note that setter functions are used instead of direct state variable assignments
to use access control at deploy time. Only ADMIN can call this function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the `ZNSAccessController` contract |
| registry_ | address | The address of the `ZNSRegistry` contract |

### resolveDomainAddress

```solidity
function resolveDomainAddress(bytes32 domainHash) external view returns (address)
```

Returns address associated with a given domain name hash.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The identifying hash of a domain's name |

### setAddress

```solidity
function setAddress(bytes32 domainHash, address newAddress) external
```

Sets the address for a domain name hash. This function can only
be called by the owner, operator of the domain OR by the `ZNSRootRegistrar.sol`
as a part of the Register flow.
Emits an `AddressSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The identifying hash of a domain's name |
| newAddress | address | The new address to map the domain to |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

ERC-165 check for implementation identifier
Supports interfaces `IZNSAddressResolver` and `IERC165`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| interfaceId | bytes4 | ID to check, XOR of the first 4 bytes of each function signature |

### getInterfaceId

```solidity
function getInterfaceId() public pure returns (bytes4)
```

Exposes IZNSAddressResolver interfaceId

### setRegistry

```solidity
function setRegistry(address _registry) public
```

Sets the address of the `ZNSRegistry` contract that holds all crucial data
for every domain in the system. This function can only be called by the ADMIN.
Emits a `RegistrySet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _registry | address | The address of the `ZNSRegistry` contract |

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal view
```

To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized

