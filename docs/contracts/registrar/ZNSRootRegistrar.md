## ZNSRootRegistrar


**Main entry point for the three main flows of ZNS - Register Root Domain, Reclaim and Revoke any domain.**

This contract serves as the "umbrella" for many ZNS operations, it is given REGISTRAR_ROLE
to combine multiple calls/operations between different modules to achieve atomic state changes
and proper logic for the ZNS flows. You can see functions in other modules that are only allowed
to be called by this contract to ensure proper management of ZNS data in multiple places.
RRR - Register, Reclaim, Revoke start here and then call other modules to complete the flow.
ZNSRootRegistrar.sol stores most of the other contract addresses and can communicate with other modules,
but the relationship is one-sided, where other modules do not need to know about the ZNSRootRegistrar.sol,
they only check REGISTRAR_ROLE that can, in theory, be assigned to any other address.

This contract is also called at the last stage of registering subdomains, since it has the common
logic required to be performed for any level domains.



### rootPricer

```solidity
contract IZNSPricer rootPricer
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







### subRegistrar

```solidity
contract IZNSSubRegistrar subRegistrar
```







### initialize

```solidity
function initialize(address accessController_, address registry_, address rootPricer_, address treasury_, address domainToken_, address addressResolver_) external
```


Create an instance of the ZNSRootRegistrar.sol
for registering, reclaiming and revoking ZNS domains

Instead of direct assignments, we are calling the setter functions
to apply Access Control and ensure only the ADMIN can set the addresses.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | Address of the ZNSAccessController contract |
| registry_ | address | Address of the ZNSRegistry contract |
| rootPricer_ | address | Address of the IZNSPricer type contract that Zero chose to use for the root domains |
| treasury_ | address | Address of the ZNSTreasury contract |
| domainToken_ | address | Address of the ZNSDomainToken contract |
| addressResolver_ | address | Address of the ZNSAddressResolver contract |


### registerRootDomain

```solidity
function registerRootDomain(string name, address domainAddress, string tokenURI, struct IDistributionConfig.DistributionConfig distributionConfig) external returns (bytes32)
```


This function is the main entry point for the Register Root Domain flow.
Registers a new root domain such as `0://wilder`.
Gets domain hash as a keccak256 hash of the domain label string casted to bytes32,
checks existence of the domain in the registry and reverts if it exists.
Calls `ZNSTreasury` to do the staking part, gets `tokenId` for the new token to be minted
as domain hash casted to uint256, mints the token and sets the domain data in the `ZNSRegistry`
and, possibly, `ZNSAddressResolver`. Emits a `DomainRegistered` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | string | Name (label) of the domain to register |
| domainAddress | address | (optional) Address for the `ZNSAddressResolver` to return when requested |
| tokenURI | string | URI to assign to the Domain Token issued for the domain |
| distributionConfig | struct IDistributionConfig.DistributionConfig | (optional) Distribution config for the domain to set in the same tx     > Please note that passing distribution config will add more gas to the tx and most importantly -      - the distributionConfig HAS to be passed FULLY filled or all zeros. It is optional as a whole,      but all the parameters inside are required. |


### coreRegister

```solidity
function coreRegister(struct CoreRegisterArgs args) external
```


External function used by `ZNSSubRegistrar` for the final stage of registering subdomains.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| args | struct CoreRegisterArgs | `CoreRegisterArgs`: Struct containing all the arguments required to register a domain  with ZNSRootRegistrar.coreRegister():      + `parentHash`: The hash of the parent domain (0x0 for root domains)      + `domainHash`: The hash of the domain to be registered      + `label`: The label of the domain to be registered      + `registrant`: The address of the user who is registering the domain      + `price`: The determined price for the domain to be registered based on parent rules      + `stakeFee`: The determined stake fee for the domain to be registered (only for PaymentType.STAKE!)      + `domainAddress`: The address to which the domain will be resolved to      + `tokenURI`: The tokenURI for the domain to be registered      + `isStakePayment`: A flag for whether the payment is a stake payment or not |


### _coreRegister

```solidity
function _coreRegister(struct CoreRegisterArgs args) internal
```




Internal function that is called by this contract to finalize the registration of a domain.
This function as also called by the external `coreRegister()` function as a part of
registration of subdomains.
This function kicks off payment processing logic, mints the token, sets the domain data in the `ZNSRegistry`
and fires a `DomainRegistered` event.
For params see external `coreRegister()` docs.



### _processPayment

```solidity
function _processPayment(struct CoreRegisterArgs args) internal
```




Internal function that is called by this contract to finalize the payment for a domain.
Once the specific case is determined and `protocolFee` calculated, it calls ZNSTreasury to perform transfers.



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
for the same name cheaper, since SSTORE on a non-zero slot costs 5k gas,
while SSTORE on a zero slot costs 20k gas.
If a user wants to clear his data from `ZNSAddressResolver`, he can call `ZNSAddressResolver` directly himself
BEFORE he calls to revoke, otherwise, `ZNSRegistry` owner check will fail, since the owner there
will be 0x0 address.
Also note that in order to Revoke, a caller has to be the owner of both:
Name (in `ZNSRegistry`) and Token (in `ZNSDomainToken`).

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | Hash of the domain to revoke |


### _coreRevoke

```solidity
function _coreRevoke(bytes32 domainHash, address owner) internal
```




Internal part of the `revokeDomain()`. Called by this contract to finalize the Revoke flow of all domains.
It calls `ZNSDomainToken` to burn the token, deletes the domain data from the `ZNSRegistry` and
calls `ZNSTreasury` to unstake and withdraw funds user staked for the domain. Also emits
a `DomainRevoked` event.



### reclaimDomain

```solidity
function reclaimDomain(bytes32 domainHash) external
```


This function is the main entry point for the Reclaim flow. This flow is used to
reclaim full ownership of a domain (through becoming the owner of the Name) from the ownership of the Token.
This is used for different types of ownership transfers, such as:
- domain sale - a user will sell the Token, then the new owner has to call this function to reclaim the Name
- domain transfer - a user will transfer the Token, then the new owner
has to call this function to reclaim the Name

A user needs to only be the owner of the Token to be able to Reclaim.
Updates the domain owner in the `ZNSRegistry` to the owner of the token and emits a `DomainReclaimed` event.




### isOwnerOf

```solidity
function isOwnerOf(bytes32 domainHash, address candidate, enum IZNSRootRegistrar.OwnerOf ownerOf) public view returns (bool)
```


Function to validate that a given candidate is the owner of his Name, Token or both.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | Hash of the domain to check |
| candidate | address | Address of the candidate to check for ownership of the above domain's properties |
| ownerOf | enum IZNSRootRegistrar.OwnerOf | Enum value to determine which ownership to check for: NAME, TOKEN, BOTH |


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


### setRootPricer

```solidity
function setRootPricer(address rootPricer_) public
```


Setter for the IZNSPricer type contract that Zero chooses to handle Root Domains.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| rootPricer_ | address | Address of the IZNSPricer type contract to set as pricer of Root Domains |


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


### setSubRegistrar

```solidity
function setSubRegistrar(address subRegistrar_) external
```


Setter for `ZNSSubRegistrar` contract. Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| subRegistrar_ | address | Address of the `ZNSSubRegistrar` contract |


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


### _isValidString

```solidity
function _isValidString(string str) internal pure returns (bool)
```







### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |



