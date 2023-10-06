## ZNSTreasury


**IZNSTreasury.sol - Interface for the ZNSTreasury contract responsible for managing payments and staking.**



This contract is not also the performer of all transfers, but it also stores staked funds for ALL domains
that use PaymentType.STAKE. This is to ensure that the funds are not locked in the domain owner's wallet,
but are held within the system and users do not have access to them while their respective domains are active.
It also stores the payment configurations for all domains and staked amounts and token addresses which were used.
This information is needed for revoking users to withdraw their stakes back when they exit the system.



### paymentConfigs

```solidity
mapping(bytes32 => struct PaymentConfig) paymentConfigs
```


The mapping that stores the payment configurations for each domain.
Zero's own configs for root domains is stored under 0x0 hash.




### stakedForDomain

```solidity
mapping(bytes32 => struct IZNSTreasury.Stake) stakedForDomain
```


The mapping that stores `Stake` struct mapped by domainHash. It stores the staking data for each domain in zNS.
Note that there is no owner address to which the stake is tied to. Instead, the owner data from `ZNSRegistry`
is used to identify a user who owns the stake. So the staking data is tied to the owner of the Name.
This should be taken into account, since any transfer of the Token to another address,
and the system, allowing them to Reclaim the Name, will also allow them to withdraw the stake.
> Stake is owned by the owner of the Name in `ZNSRegistry` which the owner of the Token can reclaim!




### initialize

```solidity
function initialize(address accessController_, address registry_, address paymentToken_, address zeroVault_) external
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
| registry_ | address | The address of the `ZNSRegistry` contract. |
| paymentToken_ | address | The address of the staking token (currently $ZERO). |
| zeroVault_ | address | The address of the Zero Vault - the wallet or contract to collect all the registration fees. |


### stakeForDomain

```solidity
function stakeForDomain(bytes32 parentHash, bytes32 domainHash, address depositor, uint256 stakeAmount, uint256 stakeFee, uint256 protocolFee) external
```


Performs all the transfers for the staking payment. This function is called by `ZNSRootRegistrar.sol`
when a user wants to register a domain. It transfers the stake amount and the registration fee
to the contract from the user, and records the staked amount for the domain.
Note that a user has to approve the correct amount of `domainPrice + stakeFee + protocolFee`
for this function to not revert.

Reads parent's payment config from state and transfers the stake amount and all fees to this contract.
After that transfers the protocol fee to the Zero Vault from this contract to respective beneficiaries.
After transfers have been performed, saves the staking data into `stakedForDomain[domainHash]`
and fires a `StakeDeposited` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentHash | bytes32 | The hash of the parent domain. |
| domainHash | bytes32 | The hash of the domain for which the stake is being deposited. |
| depositor | address | The address of the user who is depositing the stake. |
| stakeAmount | uint256 | The amount of the staking token to be deposited. |
| stakeFee | uint256 | The registration fee paid by the user on top of the staked amount to the parent domain owner. |
| protocolFee | uint256 | The protocol fee paid by the user to Zero. |


### unstakeForDomain

```solidity
function unstakeForDomain(bytes32 domainHash, address owner) external
```


Withdraws the stake for a domain. This function is called by `ZNSRootRegistrar.sol`
when a user wants to Revoke a domain. It transfers the stake amount from the contract back to the user,
and deletes the stake data for the domain in state. Only REGISTRAR_ROLE can call this function.
Emits a `StakeWithdrawn` event.
Since we are clearing storage, gas refund from this operation makes Revoke transactions cheaper.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain for which the stake is being withdrawn. |
| owner | address | The address of the user who is withdrawing the stake. |


### processDirectPayment

```solidity
function processDirectPayment(bytes32 parentHash, bytes32 domainHash, address payer, uint256 paymentAmount, uint256 protocolFee) external
```


An alternative to `stakeForDomain()` for cases when a parent domain is using PaymentType.DIRECT.

Note that `stakeFee` transfers are NOT present here, since a fee on top of the price is ONLY supported
for STAKE payment type. This function is called by `ZNSRootRegistrar.sol` when a user wants to register a domain.
This function uses a different approach than `stakeForDomain()` as it performs 2 transfers from the user's wallet.
Is uses `paymentConfigs[parentHash]` to get the token and beneficiary for the parent domain.
Can be called ONLY by the REGISTRAR_ROLE. Fires a `DirectPaymentProcessed` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentHash | bytes32 | The hash of the parent domain. |
| domainHash | bytes32 | The hash of the domain for which the stake is being deposited. |
| payer | address | The address of the user who is paying for the domain. |
| paymentAmount | uint256 | The amount of the payment token to be deposited. |
| protocolFee | uint256 | The protocol fee paid by the user to Zero. |


### setPaymentConfig

```solidity
function setPaymentConfig(bytes32 domainHash, struct PaymentConfig paymentConfig) external
```


Setter function for the `paymentConfig` chosen by domain owner.
Only domain owner/operator can call this.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain to set payment config for |
| paymentConfig | struct PaymentConfig | The payment config to be set for the domain (see IZNSTreasury.sol for details) |


### setBeneficiary

```solidity
function setBeneficiary(bytes32 domainHash, address beneficiary) public
```


Setter function for the `PaymentConfig.beneficiary` address chosen by domain owner.
Only domain owner/operator can call this. Fires a `BeneficiarySet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain to set beneficiary for |
| beneficiary | address | The address of the new beneficiary  - the wallet or contract to collect all payments for the domain. |


### setPaymentToken

```solidity
function setPaymentToken(bytes32 domainHash, address paymentToken) public
```


Setter function for the `PaymentConfig.token` chosen by the domain owner.
Only domain owner/operator can call this. Fires a `PaymentTokenSet` event.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain to set payment token for |
| paymentToken | address | The address of the new payment/staking token |


### setRegistry

```solidity
function setRegistry(address registry_) external
```


Sets the registry address in state.

This function is required for all contracts inheriting `ARegistryWired`.



### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |



