# IZNSTreasury

### PaymentConfig

```solidity
struct PaymentConfig {
  contract IERC20 token;
  address beneficiary;
}
```

### IZNSTreasury

**IZNSTreasury.sol - Interface for the ZNSTreasury contract responsible for managing payments and staking.**

Below are docs for the types in this file:

* `PaymentConfig`: Struct containing data for the payment configuration of the parent distributing subdomains:
  * `token`: The address of the ERC-20 compliant payment token contract chosen by the parent
  * `beneficiary`: The address of the beneficiary contract or wallet that will receive payments or fees
* `Stake`: Struct containing data for the staking of a domain written at the time of staking:
  * `token`: The address of the ERC-20 compliant staking token used to deposit a specific stake for domain
  * `amount`: The amount of the staking token above deposited by the user

#### Stake

```solidity
struct Stake {
  contract IERC20 token;
  uint256 amount;
}
```

#### StakeDeposited

```solidity
event StakeDeposited(bytes32 parentHash, bytes32 domainHash, address depositor, address stakingToken, uint256 stakeAmount, uint256 stakeFee, uint256 protocolFee)
```

Emitted when a new stake is deposited upon registration of a new domain.

**Parameters**

| Name         | Type    | Description                                                               |
| ------------ | ------- | ------------------------------------------------------------------------- |
| parentHash   | bytes32 |                                                                           |
| domainHash   | bytes32 | The hash of the domain name                                               |
| depositor    | address | The address of the depositing user / new domain owner                     |
| stakingToken | address |                                                                           |
| stakeAmount  | uint256 | The amount they are depositing / price of the domain based on name length |
| stakeFee     | uint256 | The registration fee paid by the user on top of the staked amount         |
| protocolFee  | uint256 |                                                                           |

#### StakeWithdrawn

```solidity
event StakeWithdrawn(bytes32 domainHash, address owner, address stakingToken, uint256 stakeAmount)
```

Emitted when a stake is withdrawn upon domain revocation.

**Parameters**

| Name         | Type    | Description                                            |
| ------------ | ------- | ------------------------------------------------------ |
| domainHash   | bytes32 | The hash of the domain name being revoked              |
| owner        | address | The owner of the domain being revoked                  |
| stakingToken | address |                                                        |
| stakeAmount  | uint256 | The staked amount withdrawn to the user after revoking |

#### DirectPaymentProcessed

```solidity
event DirectPaymentProcessed(bytes32 parentHash, bytes32 domainHash, address payer, address beneficiary, uint256 amount, uint256 protocolFee)
```

Emitted when a direct payment is processed upon registration of a new domain.

**Parameters**

| Name        | Type    | Description                                                                 |
| ----------- | ------- | --------------------------------------------------------------------------- |
| parentHash  | bytes32 | The hash of the parent domain                                               |
| domainHash  | bytes32 | The full namehash of the domain registered                                  |
| payer       | address | The address of the user who paid for the domain                             |
| beneficiary | address | The address of the beneficiary contract or wallet that received the payment |
| amount      | uint256 | The amount paid by the user                                                 |
| protocolFee | uint256 | The protocol fee paid by the user to Zero                                   |

#### CurvePricerSet

```solidity
event CurvePricerSet(address curvePricer)
```

Emitted when `curvePricer` is set in state.

**Parameters**

| Name        | Type    | Description                                 |
| ----------- | ------- | ------------------------------------------- |
| curvePricer | address | The new address of the CurvePricer contract |

#### PaymentTokenSet

```solidity
event PaymentTokenSet(bytes32 domainHash, address token)
```

Emitted when `stakingToken` is set in state.

**Parameters**

| Name       | Type    | Description                                                    |
| ---------- | ------- | -------------------------------------------------------------- |
| domainHash | bytes32 |                                                                |
| token      | address | The new address of the ERC-20 compliant payment token contract |

#### BeneficiarySet

```solidity
event BeneficiarySet(bytes32 domainHash, address beneficiary)
```

Emitted when `zeroVault` is set in state.

**Parameters**

| Name        | Type    | Description                                           |
| ----------- | ------- | ----------------------------------------------------- |
| domainHash  | bytes32 |                                                       |
| beneficiary | address | The new address of the beneficiary contract or wallet |

#### paymentConfigs

```solidity
function paymentConfigs(bytes32 domainHash) external view returns (contract IERC20 token, address beneficiary)
```

#### stakedForDomain

```solidity
function stakedForDomain(bytes32 domainHash) external view returns (contract IERC20, uint256)
```

#### stakeForDomain

```solidity
function stakeForDomain(bytes32 parentHash, bytes32 domainHash, address depositor, uint256 stakeAmount, uint256 stakeFee, uint256 protocolFee) external
```

#### unstakeForDomain

```solidity
function unstakeForDomain(bytes32 domainHash, address owner) external
```

#### processDirectPayment

```solidity
function processDirectPayment(bytes32 parentHash, bytes32 domainHash, address payer, uint256 paymentAmount, uint256 protocolFee) external
```

#### setPaymentConfig

```solidity
function setPaymentConfig(bytes32 domainHash, struct PaymentConfig paymentConfig) external
```

#### setBeneficiary

```solidity
function setBeneficiary(bytes32 domainHash, address beneficiary) external
```

#### setPaymentToken

```solidity
function setPaymentToken(bytes32 domainHash, address paymentToken) external
```

#### setRegistry

```solidity
function setRegistry(address registry_) external
```

#### initialize

```solidity
function initialize(address accessController_, address curvePricer_, address stakingToken_, address zeroVault_) external
```
