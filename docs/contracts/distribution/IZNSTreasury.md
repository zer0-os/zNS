## IZNSTreasury








### StakeDeposited

```solidity
event StakeDeposited(bytes32 domainHash, string domainName, address depositor, uint256 stakeAmount, uint256 registrationFee)
```


Emitted when a new stake is deposited upon registration of a new domain.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain name |
| domainName | string | The domain name as a string |
| depositor | address | The address of the depositing user / new domain owner |
| stakeAmount | uint256 | The amount they are depositing / price of the domain based on name length |
| registrationFee | uint256 | The registration fee paid by the user on top of the staked amount |


### StakeWithdrawn

```solidity
event StakeWithdrawn(bytes32 domainHash, address owner, uint256 stakeAmount)
```


Emitted when a stake is withdrawn upon domain revocation.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain name being revoked |
| owner | address | The owner of the domain being revoked |
| stakeAmount | uint256 | The staked amount withdrawn to the user after revoking |


### PriceOracleSet

```solidity
event PriceOracleSet(address priceOracle)
```


Emitted when `priceOracle` is set in state.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceOracle | address | The new address of the price oracle contract |


### StakingTokenSet

```solidity
event StakingTokenSet(address stakingToken)
```


Emitted when `stakingToken` is set in state.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| stakingToken | address | The new address of the ERC-20 compliant staking token contract |


### ZeroVaultAddressSet

```solidity
event ZeroVaultAddressSet(address zeroVault)
```


Emitted when `zeroVault` is set in state.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| zeroVault | address | The new address of the zero vault contract or wallet |


### stakeForDomain

```solidity
function stakeForDomain(bytes32 domainHash, string domainName, address depositor) external
```







### unstakeForDomain

```solidity
function unstakeForDomain(bytes32 domainHash, address owner) external
```







### setZeroVaultAddress

```solidity
function setZeroVaultAddress(address zeroVaultAddress) external
```







### setPriceOracle

```solidity
function setPriceOracle(address priceOracle_) external
```







### setStakingToken

```solidity
function setStakingToken(address stakingToken_) external
```







### setAccessController

```solidity
function setAccessController(address accessController) external
```







### getAccessController

```solidity
function getAccessController() external view returns (address)
```







### initialize

```solidity
function initialize(address accessController_, address priceOracle_, address stakingToken_, address zeroVault_) external
```








