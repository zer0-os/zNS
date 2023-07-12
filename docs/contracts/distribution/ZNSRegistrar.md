## ZNSRegistrar


**Main entry point for the three main flows of ZNS - Register, Reclaim and Revoke a domain.**

This contract serves as the "umbrella" for many ZNS operations, it is given REGISTRAR_ROLE
to combine multiple calls/operations between different modules to achieve atomic state changes
and proper logic for the ZNS flows. You can see functions in other modules that are only allowed
to be called by this contract to ensure proper management of ZNS data in multiple places.
RRR - Register, Reclaim, Revoke start here and then call other modules to complete the flow.
ZNSRegistrar stores most of the other contract addresses and can communicate with other modules,
but the relationship is one-sided, where other modules do not need to know about the ZNSRegistrar,
they only check REGISTRAR_ROLE that can, in theory, be assigned to any other address.




### registry

```solidity
contract IZNSRegistry registry
```







### treasury

```solidity
contract IZNSTreasury treasury
```







### domainToken

```solidity
contract IZNSDomainToken domainToken
```







### addressResolver

```solidity
contract IZNSAddressResolver addressResolver
```







### onlyNameOwner

```solidity
modifier onlyNameOwner(bytes32 domainHash)
```


Ensures only the owner of the Name in ZNSRegistry can call.




### onlyTokenOwner

```solidity
modifier onlyTokenOwner(bytes32 domainHash)
```


Ensures only the owner of the Tame in ZNSDomainToken can call.




### initialize

```solidity
function initialize(address accessController_, address registry_, address treasury_, address domainToken_, address addressResolver_) public
```


Create an instance of the ZNSRegistrar
for registering, reclaiming and revoking ZNS domains

Instead of direct assignments, we are calling the setter functions
to apply Access Control and ensure only the ADMIN can set the addresses.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | Address of the ZNSAccessController contract |
| registry_ | address | Address of the ZNSRegistry contract |
| treasury_ | address | Address of the ZNSTreasury contract |
| domainToken_ | address | Address of the ZNSDomainToken contract |
| addressResolver_ | address | Address of the ZNSAddressResolver contract |


### registerDomain

```solidity
function registerDomain(string name, address domainAddress) external returns (bytes32)
```


This function is the main entry point for the Register flow.
Registers a new domain such as `0://wilder`.
Gets domain hash as a keccak256 hash of the domain label string casted to bytes32,
checks existence of the domain in the registry and reverts if it exists.
Calls `ZNSTreasury` to do the staking part, gets `tokenId` for the new token to be minted
as domain hash casted to uint256, mints the token and sets the domain data in the `ZNSRegistry`
and, possibly, `ZNSAddressResolver`. Emits a `DomainRegistered` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | string | Name (label) of the domain to register |
| domainAddress | address | Address for the `ZNSAddressResolver` to return when requested (optional, send 0x0 if not needed) |


### revokeDomain

```solidity
function revokeDomain(bytes32 domainHash) external
```


This function is the main entry point for the Revoke flow.
Revokes a domain such as `0://wilder`.
Gets `tokenId` from casted domain hash to uint256, calls `ZNSDomainToken` to burn the token,
deletes the domain data from the `ZNSRegistry` and calls `ZNSTreasury` to unstake and withdraw funds
user staked for the domain. Emits a `DomainRevoked` event.

> Note that we are not clearing the data in `ZNSAddressResolver` as it is considered not necessary
since none other contracts will have the domain data on them.
If we are not clearing `ZNSAddressResolver` state slots, we are making the next Register transaction
for the same name cheaper, since SSTORE on a non-zero slot costs 5k gas, while SSTORE on a zero slot costs 20k gas.
If a user wants to clear his data from `ZNSAddressResolver`, he can call `ZNSAddressResolver` directly himself
BEFORE he calls to revoke, otherwise, `ZNSRegistry` owner check will fail, since the owner there
will be 0x0 address.
Also note that in order to Revoke, a caller has to be the owner of both:
Name (in `ZNSRegistry`) and Token (in `ZNSDomainToken`).

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | Hash of the domain to revoke |


### reclaimDomain

```solidity
function reclaimDomain(bytes32 domainHash) external
```


This function is the main entry point for the Reclaim flow. This flow is used to
reclaim full ownership of a domain (through becoming the owner of the Name) from the ownership of the Token.
This is used for different types of ownership transfers, such as:
- domain sale - a user will sell the Token, then the new owner has to call this function to reclaim the Name
- domain transfer - a user will transfer the Token, then the new owner has to call this function to reclaim the Name

A user needs to only be the owner of the Token to be able to Reclaim.
Updates the domain owner in the `ZNSRegistry` to the owner of the token and emits a `DomainReclaimed` event.




### setRegistry

```solidity
function setRegistry(address registry_) public
```


Setter function for the `ZNSRegistry` address in state.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| registry_ | address | Address of the `ZNSRegistry` contract |


### setTreasury

```solidity
function setTreasury(address treasury_) public
```


Setter function for the `ZNSTreasury` address in state.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| treasury_ | address | Address of the `ZNSTreasury` contract |


### setDomainToken

```solidity
function setDomainToken(address domainToken_) public
```


Setter function for the `ZNSDomainToken` address in state.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainToken_ | address | Address of the `ZNSDomainToken` contract |


### setAddressResolver

```solidity
function setAddressResolver(address addressResolver_) public
```


Setter function for the `ZNSAddressResolver` address in state.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addressResolver_ | address | Address of the `ZNSAddressResolver` contract |


### setAccessController

```solidity
function setAccessController(address accessController_) external
```


Setter function for the `ZNSAccessController` address in state.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | Address of the `ZNSAccessController` contract |


### getAccessController

```solidity
function getAccessController() external view returns (address)
```


Getter function for the `ZNSAccessController` address in state.




### _setDomainData

```solidity
function _setDomainData(bytes32 domainHash, address owner, address domainAddress) internal
```


Set domain data appropriately for a newly registered domain
If no domain address is given, only the domain owner is set, otherwise
`ZNSAddressResolver` is called to assign an address to the newly registered domain.
If the `domainAddress` is not provided upon registration, a user can call `ZNSAddressResolver.setAddress`
to set the address themselves.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain name hash |
| owner | address | The owner of the domain |
| domainAddress | address | The content (source) it resolves to |


### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |



