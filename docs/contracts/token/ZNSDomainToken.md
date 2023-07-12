## ZNSDomainToken


**A contract for tokenizing domains under ZNS. Every domain in ZNS has a corresponding token
minted at Register time. This token is also an NFT that is fully ERC-721 compliant.**



Note that all ZNS related functions on this contract can ONLY be called by either
the `ZNSRegistrar` contract or any address holding a REGISTRAR_ROLE.



### onlyRegistrar

```solidity
modifier onlyRegistrar()
```


Modifier used in functions to be called only by the `ZNSRegistrar` contract
or address with REGISTRAR_ROLE.




### initialize

```solidity
function initialize(address accessController_, string name_, string symbol_) external
```


Initializer for the `ZNSDomainToken` proxy.
Note that this function does NOT have role protection enforced!


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the `ZNSAccessController` contract |
| name_ | string | The name of the token |
| symbol_ | string | The symbol of the token |


### register

```solidity
function register(address to, uint256 tokenId) external
```


Mints a token with a specified tokenId, using _safeMint, and sends it to the given address.
Used ONLY as a part of the Register flow that starts from ``ZNSRegistrar.registerDomain()``!
> TokenId is created as a hash of the domain name casted to uint256.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address that will recieve the newly minted domain token (new domain owner) |
| tokenId | uint256 | The TokenId that the caller wishes to mint/register. |


### revoke

```solidity
function revoke(uint256 tokenId) external
```


Burns the token with the specified tokenId.
Used ONLY as a part of the Revoke flow that starts from ``ZNSRegistrar.revokeDomain()``!


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The tokenId (as `uint256(domainHash)`) that the caller wishes to burn/revoke |


### setAccessController

```solidity
function setAccessController(address accessController_) external
```




Sets the address of the `ZNSAccessController` contract.
Can only be called by the ADMIN. Emits an `AccessControllerSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the `ZNSAccessController` contract |


### getAccessController

```solidity
function getAccessController() external view returns (address)
```




Returns the address of the `ZNSAccessController` contract saved in state.



### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |



