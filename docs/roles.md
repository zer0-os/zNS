# zNS Access Roles and Their Privileges

## `GOVERNOR_ROLE` privileges:
- The UUPS function `upgradeToAndCall()` allows governors to update the implementation used and invoke a call in upgradeable
contracts. 
- The UUPS function `upgradeTo()` allows governors to update the implementation used in upgradeable contracts. 
- The governors can grant `GOVERNOR_ROLE` to addresses. 
- The governors can grant `ADMIN_ROLE` to addresses. 
- The governors can grant any role to any address through the function `ZNSAccessController.setRoleAdmin()` .

## `ADMIN_ROLE` privileges:
- The function `setRegistry()` allows admins to update the registry address for contracts inheriting `ARegistryWired`:
  - `ZNSCurvePricer` 
  - `ZNSRootRegistrar` 
  - `ZNSSubRegistrar` 
  - `ZNSAddressResolver` 
  - `ZNSDomainToken` 
  - `ZNSTreasury`
- The function `ZNSRootRegister.setRootPricer()` allows admins to update the pricer contract used to determine pricing for root
domains. 
- The function `ZNSRootRegister.setTreasury()` allows admins to update the `ZNSTreasury` contract used to store protocol fees
and staked funds. 
- The function `ZNSRootRegister.setDomainToken()` allows admins to update the domain token contract used to validate domain
ownership. 
- The function `ZNSRootRegister.setSubRegistrar()` allows admins to update the subdomain registrar contract. 
- The function `ZNSRootRegister.setAddressResolver()` allows admins to update the root domain resolver. 
- The admins can grant `REGISTRAR_ROLE` to addresses.

## `REGISTRAR_ROLE` privileges:
- The function `ZNSRootRegister.coreRegister()` allows registrars to register domains. 
- The function `ZNSRegistry.createDomainRecord()` allows registrars to register domain records which track ownership and address
resolver. 
- `ZNSRegistry.addResolverType`
- `ZNSRegistry.deleteResolverType`
- The function `ZNSDomainToken.register()` allows registrars to mint tokens which are used to validate domain ownership. 
- The function `ZNSDomainToken.revoke()` allows registrars to burn tokens to revoke domain ownership. 
- The function `ZNSTreasury.stakeForDomain()` allows registrars to process registration fee to beneficiaries and stake domain funds
in the treasury. The staked funds are returned to the domain owner when the domain is revoked. 
- The function `ZNSTreasury.unstakeForDomain()` allows registrars to unstake domain registration funds in the treasury during the
domain revocation process. 
- The function `ZNSTreasury.processDirectPayment()` allows registrars to process registration fees to beneficiaries directly.
>The `REGISTRAR_ROLE` is reserved for contracts ZNSRootRegistrar and ZNSSubRegistrar only.

>`EXECUTOR_ROLE` does not have any privileges. This role may be used for future implementations and additions.