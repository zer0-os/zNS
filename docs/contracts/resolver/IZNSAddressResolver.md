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




ERC-165 check for implementation identifier
Supports interfaces IZNSAddressResolver and IERC165

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| interfaceId | bytes4 | ID to check, XOR of the first 4 bytes of each function signature |


### getAddress

```solidity
function getAddress(bytes32 domainHash) external view returns (address)
```




Resolves address given domain name hash

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The identifying hash of a domain's name |


### setAddress

```solidity
function setAddress(bytes32 domainHash, address newAddress) external
```




Sets the address of a domain name hash, only registry

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The identifying hash of a domain's name |
| newAddress | address | The new domain owner |


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


Initialize an instance of the ZNSAddressResolver


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _accessController | address | The access controller |
| _registry | address | The registry address |



