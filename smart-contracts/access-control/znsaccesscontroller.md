# ZNSAccessController

**The main module for system-wide Access Control.**

ZNS Business Logic Contract access to this module is outlined in `AAccessControlled.sol`. Uses a role-based access control scheme with levels:

* GOVERNOR: The highest rank, assigns Admins, new roles and Role Admins
* ADMIN: The main maintainer role, that gets access to all system functions (managed by Governor)
* EXECUTOR: Can be here to future proof, if we need a new role (managed by Governor)
* REGISTRAR: This role is here specifically for the ZNSRootRegistrar.sol contract (managed by Admin)

> This contract is NOT proxied. When new implementation is needed, a new contract will be deployed and all modules will be updated to use the new address, since they all inherit from `AAccessControlled.sol`.

## constructor

```solidity
constructor(address[] governorAddresses, address[] adminAddresses) public
```

## checkGovernor

```solidity
function checkGovernor(address account) external view
```

## checkAdmin

```solidity
function checkAdmin(address account) external view
```

## checkExecutor

```solidity
function checkExecutor(address account) external view
```

## checkRegistrar

```solidity
function checkRegistrar(address account) external view
```

## isAdmin

```solidity
function isAdmin(address account) external view returns (bool)
```

## isRegistrar

```solidity
function isRegistrar(address account) external view returns (bool)
```

## isGovernor

```solidity
function isGovernor(address account) external view returns (bool)
```

## isExecutor

```solidity
function isExecutor(address account) external view returns (bool)
```

## setRoleAdmin

```solidity
function setRoleAdmin(bytes32 role, bytes32 adminRole) external
```

## \_grantRoleToMany

```solidity
function _grantRoleToMany(bytes32 role, address[] addresses) internal
```
