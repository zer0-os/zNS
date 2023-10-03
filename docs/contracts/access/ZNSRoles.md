## ZNSRoles


**Outlines the roles used in the ZNS system**



> Inherited ONLY by `ZNSAccessController`



### GOVERNOR_ROLE

```solidity
bytes32 GOVERNOR_ROLE
```


The highest rank, assigns Admins, new roles and Role Admins




### ADMIN_ROLE

```solidity
bytes32 ADMIN_ROLE
```


The main maintainer role, that gets access to all system functions




### REGISTRAR_ROLE

```solidity
bytes32 REGISTRAR_ROLE
```


This role is here specifically for the ZNSRootRegistrar.sol contract




### EXECUTOR_ROLE

```solidity
bytes32 EXECUTOR_ROLE
```


Executor can be here to future proof, if we need a new role
so we don't have to upgrade all contracts





