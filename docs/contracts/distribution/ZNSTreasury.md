## ZNSTreasury


**Contract responsible for all staking operations in ZNS and communication with `ZNSPriceOracle`.**

This contract it called by `ZNSRegistrar` every time a staking operation is needed.
It stores all data regarding user stakes for domains, and it's also the only contract
that is aware of the `ZNSPriceOracle` which it uses to get pricing data for domains.




### priceOracle

```solidity
contract IZNSPriceOracle priceOracle
```


The address of the `ZNSPriceOracle` contract.




### stakingToken

```solidity
contract IERC20 stakingToken
```


The address of the payment/staking token. Will be set to $ZERO.




### zeroVault

```solidity
address zeroVault
```


Address of the Zero Vault, a wallet or contract which gathers all the registration fees.




### stakedForDomain

```solidity
mapping(bytes32 => uint256) stakedForDomain
```


The main mapping of the contract. It stores the amount staked for each domain
which is mapped to the domain hash.
Note that there is no address to which the stake is tied to. Instead, the owner data from `ZNSRegistry`
is used to identify a user who owns the stake. So the staking data is tied to the owner of the Name.
This should be taken into account, since any transfer of the Token to another address,
and the system, allowing them to Reclaim the Name, will also allow them to withdraw the stake.
> Stake is owned by the owner of the Name in `ZNSRegistry`!




### onlyRegistrar

```solidity
modifier onlyRegistrar()
```


Modifier used for functions that are only allowed to be called by the `ZNSRegistrar`
or any other address that has REGISTRAR_ROLE.




### initialize

```solidity
function initialize(address accessController_, address priceOracle_, address stakingToken_, address zeroVault_) external
```


`ZNSTreasury` proxy state initializer. Note that setter functions are used
instead of direct state variable assignments in order to use proper Access Control
at initialization. Only ADMIN in `ZNSAccessController` can call this function.
For this also, it is important that `ZNSAccessController` is deployed and initialized with role data
before this contract is deployed.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the `ZNSAccessController` contract. |
| priceOracle_ | address | The address of the `ZNSPriceOracle` contract. |
| stakingToken_ | address | The address of the staking token (currently $ZERO). |
| zeroVault_ | address | The address of the Zero Vault - the wallet or contract to collect all the registration fees. |


### stakeForDomain

```solidity
function stakeForDomain(bytes32 domainHash, string domainName, address depositor) external
```


Deposits the stake for a domain. This function is called by `ZNSRegistrar`
when a user wants to Register a domain. It transfers the stake amount and the registration fee
to the contract from the user, and records the staked amount for the domain.
Note that a user has to approve the correct amount of `domainPrice + registrationFee`
for this function to not revert.

Calls `ZNSPriceOracle` to get the price for the domain name based on it's length,
and to get a proper `registrationFee` as a percentage of the price.
In order to avoid needing 2 different approvals, it withdraws `domainPrice + registrationFee`
to this contract and then transfers the `registrationFee` to the Zero Vault.
Sets the `stakedForDomain` mapping for the domain to the `stakeAmount` and emits a `StakeDeposited` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain for which the stake is being deposited. |
| domainName | string | The name of the domain for which the stake is being deposited. |
| depositor | address | The address of the user who is depositing the stake. |


### unstakeForDomain

```solidity
function unstakeForDomain(bytes32 domainHash, address owner) external
```


Withdraws the stake for a domain. This function is called by `ZNSRegistrar`
when a user wants to Revoke a domain. It transfers the stake amount from the contract back to the user,
and deletes the staked amount for the domain in state.
Emits a `StakeWithdrawn` event.
Since we are clearing a slot in storage, gas refund from this operation makes Revoke transactions cheaper.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain for which the stake is being withdrawn. |
| owner | address | The address of the user who is withdrawing the stake. |


### setZeroVaultAddress

```solidity
function setZeroVaultAddress(address zeroVault_) public
```


Setter function for the `zeroVault` state variable.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| zeroVault_ | address | The address of the new Zero Vault - the wallet or contract to collect all the fees. |


### setPriceOracle

```solidity
function setPriceOracle(address priceOracle_) public
```


Setter function for the `priceOracle` state variable.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceOracle_ | address | The address of the new `ZNSPriceOracle` contract. |


### setStakingToken

```solidity
function setStakingToken(address stakingToken_) public
```


Setter function for the `stakingToken` state variable.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| stakingToken_ | address | The address of the new staking token (currently $ZERO). |


### setAccessController

```solidity
function setAccessController(address accessController_) public
```


Setter function for the `accessController` state variable.
Only ADMIN in `ZNSAccessController` can call this function.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the new `ZNSAccessController` contract. |


### getAccessController

```solidity
function getAccessController() external view returns (address)
```


Getter function for the `accessController` state variable inherited from `AccessControlled`.




### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |



