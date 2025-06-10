## ZNSSubRegistrar

**ZNSSubRegistrar.sol - The contract for registering and revoking subdomains of zNS.**

This contract has the entry point for registering subdomains, but calls
the `ZNSRootRegistrar` back to finalize registration canonically. Common logic for domains
of any level is in the `ZNSRootRegistrar.coreRegister()`.

### rootRegistrar

```solidity
contract IZNSRootRegistrar rootRegistrar
```

State var for the `ZNSRootRegistrar` contract that finalizes registration of subdomains.

### distrConfigs

```solidity
mapping(bytes32 => struct IDistributionConfig.DistributionConfig) distrConfigs
```

Mapping of domainHash to distribution config set by the domain owner/operator.
These configs are used to determine how subdomains are distributed for every parent.

Note that the rules outlined in the DistributionConfig are only applied to direct children!

### Mintlist

```solidity
struct Mintlist {
  mapping(uint256 => mapping(address => bool)) list;
  uint256 ownerIndex;
}
```

### mintlist

```solidity
mapping(bytes32 => struct ZNSSubRegistrar.Mintlist) mintlist
```

Mapping of domainHash to mintlist set by the domain owner/operator.
These configs are used to determine who can register subdomains for every parent
in the case where parent's `DistributionConfig.AccessType` is set to `AccessType.MINTLIST`.

### onlyOwnerOperatorOrRegistrar

```solidity
modifier onlyOwnerOperatorOrRegistrar(bytes32 domainHash)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address _accessController, address _registry, address _rootRegistrar) external
```

### registerSubdomain

```solidity
function registerSubdomain(struct IZNSSubRegistrar.SubdomainRegisterArgs args) public returns (bytes32)
```

Entry point to register a subdomain under a parent domain specified.

Reads the `DistributionConfig` for the parent domain to determine how to distribute,
checks if the sender is allowed to register, check if subdomain is available,
acquires the price and other data needed to finalize the registration
and calls the `ZNSRootRegistrar.coreRegister()` to finalize.
If operator is calling the function, the domain owner is set to the owner of the parent domain,
NOT the operator or caller address!
A non-zero optional `tokenOwner` address can be passed to assign the domain token to another address
which would mint the token to that address and let that address use the domain without ownership or the ability
to revoke it or manage its data in the system. This can let parent domain owner to mint subdomains
in the controlled fashion when the parent domain is LOCKED and give these domains to other users while preventing
them from transferring the ownership of the domain token or domain itself to another address or sell their own
subdomains.
Owner or operator of the parent domain circumvent the price, fee and payments and are able to register
subdomains for free, but owner will be set to the owner of the parent domain.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| args | struct IZNSSubRegistrar.SubdomainRegisterArgs | SubdomainRegisterArgs type struct with props: - `parentHash` The hash of the parent domain to register the subdomain under - `domainAddress` (optional) The address to which the subdomain will be resolved to - `tokenOwner` (optional) The address the token will be assigned to, to offer domain usage without ownership - `tokenURI` (required) The tokenURI for the subdomain to be registered - `distrConfig` (optional) The distribution config to be set for the subdomain to set rules for children - `paymentConfig` (optional) Payment config for the domain to set on ZNSTreasury in the same tx  > `paymentConfig` has to be fully filled or all zeros. It is optional as a whole,  but all the parameters inside are required. - `label` The label of the subdomain to register (e.g. in 0://zero.child the label would be "child"). |

### registerSubdomainBulk

```solidity
function registerSubdomainBulk(struct IZNSSubRegistrar.SubdomainRegisterArgs[] args) external returns (bytes32[])
```

Allows registering multiple subdomains in a single transaction.
This function iterates through an array of `SubdomainRegistrationArgs` objects and registers each subdomain
by calling the `registerSubdomain` function for each entry.

This function reduces the number of transactions required to register multiple subdomains,
saving gas and improving efficiency. Each subdomain registration is processed sequentially.

> IMPORTANT: If a subdomain in the `subRegistrations` array has `parentHash = 0x000...` (zero/null hash),
it will be treated as a nested domain under the previously registered domain in the argument array.
In this case, the parent of the subdomain will be set to the domain hash of the
previously registered subdomain in the array. This allows creating multi-level nested domains in a single
transaction.
> For example:
> - The first subdomain must have a valid `parentHash`.
> - The second subdomain can have `parentHash = 0x000...`, which means it will be nested under the first subdomain.
> - This pattern can continue for deeper levels of nesting.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| args | struct IZNSSubRegistrar.SubdomainRegisterArgs[] | An array of `SubdomainRegistrationArgs` structs, each containing:      + `parentHash`: The hash of the parent domain under which the subdomain is being registered.                     If set to `0x000...`, the parent will be the previously registered subdomain.      + `label`: The label of the subdomain to register (e.g., in `0://parent.child`, the label is `child`).      + `domainAddress`: The address to associate with the subdomain in the resolver.      + `tokenOwner`: the address token will be assigned to (optionally different than msg.sender if not 0x0)      + `tokenURI`: The URI to assign to the subdomain token.      + `distrConfig`: The distribution configuration for the subdomain.      + `paymentConfig`: The payment configuration for the subdomain. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32[] | domainHashes An array of `bytes32` hashes representing the registered subdomains. |

### hashWithParent

```solidity
function hashWithParent(bytes32 parentHash, string label) public pure returns (bytes32)
```

Helper function to hash a child label with a parent domain hash.

### setDistributionConfigForDomain

```solidity
function setDistributionConfigForDomain(bytes32 domainHash, struct IDistributionConfig.DistributionConfig config) public
```

Setter for `distrConfigs[domainHash]`.
Only domain owner/operator or `ZNSRootRegistrar` can call this function.

This config can be changed by the domain hash owner/operator at any time or be set
after registration if the config was not provided during the registration.
Fires `DistributionConfigSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the distribution config for |
| config | struct IDistributionConfig.DistributionConfig | The new distribution config to set (for config fields see `IDistributionConfig.sol`) |

### setPricerDataForDomain

```solidity
function setPricerDataForDomain(bytes32 domainHash, bytes config, contract IZNSPricer pricerContract) public
```

One of the individual setters for `distrConfigs[domainHash]`. Sets `pricerContract` and `priceConfig`
fields of the struct.
Only domain owner/operator can call this function.
Fires `PricerContractSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the pricer contract for |
| config | bytes | The price config data for the given pricer |
| pricerContract | contract IZNSPricer | The new pricer contract to set |

### setPaymentTypeForDomain

```solidity
function setPaymentTypeForDomain(bytes32 domainHash, enum IDistributionConfig.PaymentType paymentType) public
```

One of the individual setters for `distrConfigs[domainHash]`. Sets `paymentType` field of the struct.
Made to be able to set the payment type for a domain without setting the whole config.
Only domain owner/operator can call this function.
Fires `PaymentTypeSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the payment type for |
| paymentType | enum IDistributionConfig.PaymentType | The new payment type to set |

### setAccessTypeForDomain

```solidity
function setAccessTypeForDomain(bytes32 domainHash, enum IDistributionConfig.AccessType accessType) public
```

One of the individual setters for `distrConfigs[domainHash]`. Sets `accessType` field of the struct.
Made to be able to set the access type for a domain without setting the whole config.
Only domain owner/operator or ZNSRootRegistrar can call this function.
Fires `AccessTypeSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the access type for |
| accessType | enum IDistributionConfig.AccessType | The new access type to set |

### updateMintlistForDomain

```solidity
function updateMintlistForDomain(bytes32 domainHash, address[] candidates, bool[] allowed) external
```

Setter for `mintlist[domainHash][candidate]`. Only domain owner/operator can call this function.
Adds or removes candidates from the mintlist for a domain. Should only be used when the domain's owner
wants to limit subdomain registration to a specific set of addresses.
Can be used to add/remove multiple candidates at once. Can only be called by the domain owner/operator.
Fires `MintlistUpdated` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to set the mintlist for |
| candidates | address[] | The array of candidates to add/remove |
| allowed | bool[] | The array of booleans indicating whether to add or remove the candidate |

### isMintlistedForDomain

```solidity
function isMintlistedForDomain(bytes32 domainHash, address candidate) external view returns (bool)
```

Checks if a candidate is mintlisted for a given domain.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to check the mintlist for |
| candidate | address | The address to check if it is mintlisted |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool indicating whether the candidate is mintlisted for the domain |

### clearMintlistForDomain

```solidity
function clearMintlistForDomain(bytes32 domainHash) public
```

### clearMintlistAndLock

```solidity
function clearMintlistAndLock(bytes32 domainHash) external
```

Function to clear the mintlist and set the domain to `AccessType.LOCKED`.
Can only be called by the owner/operator of the domain or by `ZNSRootRegistrar` as a part of the
`revokeDomain()` flow.
This function is used to lock the domain and prevent any further registrations under it.
Emits `MintlistCleared` and `AccessTypeSet` events.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The domain hash to clear the mintlist and lock |

### setRegistry

```solidity
function setRegistry(address registry_) public
```

Sets the registry address in state.

This function is required for all contracts inheriting `ARegistryWired`.

### setRootRegistrar

```solidity
function setRootRegistrar(address registrar_) public
```

Setter for `rootRegistrar`. Only admin can call this function.
Fires `RootRegistrarSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| registrar_ | address | The new address of the ZNSRootRegistrar contract |

### pauseRegistration

```solidity
function pauseRegistration() external
```

Pauses the registration of new domains.
Only ADMIN in `ZNSAccessController` can call this function.
Fires `RegistrationPauseSet` event.

When registration is paused, only ADMINs can register new domains.

### unpauseRegistration

```solidity
function unpauseRegistration() external
```

Unpauses the registration of new domains.
Only ADMIN in `ZNSAccessController` can call this function.
Fires `RegistrationPauseSet` event.

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```

To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |

