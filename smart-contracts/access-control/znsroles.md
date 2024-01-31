# ZNSRoles

**Outlines the roles used in the ZNS system**

> Inherited ONLY by `ZNSAccessController`

## GOVERNOR\_ROLE

```solidity
bytes32 GOVERNOR_ROLE
```

The highest rank, assigns Admins, new roles and Role Admins

## ADMIN\_ROLE

```solidity
bytes32 ADMIN_ROLE
```

The main maintainer role, that gets access to all system functions

## REGISTRAR\_ROLE

```solidity
bytes32 REGISTRAR_ROLE
```

This role is here specifically for the ZNSRootRegistrar.sol contract

## EXECUTOR\_ROLE

```solidity
bytes32 EXECUTOR_ROLE
```

Executor can be here to future proof, if we need a new role so we don't have to upgrade all contracts
