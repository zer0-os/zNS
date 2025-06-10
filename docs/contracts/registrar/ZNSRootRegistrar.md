## ZNSRootRegistrar

**Main entry point for the three main flows of ZNS - Register Root Domain, Assign Domain Token
 and Revoke any domain.**

This contract serves as the "umbrella" for many ZNS operations, it is given `REGISTRAR_ROLE`
to combine multiple calls/operations between different modules to achieve atomic state changes
and proper logic for the ZNS flows. You can see functions in other modules that are only allowed
to be called by this contract to ensure proper management of ZNS data in multiple places.
Register, Assign Token and Revoke start here and then call other modules to complete the flow.
`ZNSRootRegistrar` stores most of the other contract addresses and can communicate with other modules,
but the relationship is one-sided, where other modules do not need to know about the `ZNSRootRegistrar`,
they only check `REGISTRAR_ROLE` that can, in theory, be assigned to any other address.

This contract is also called at the last stage of registering subdomains, since it has the common
logic required to be performed for any level domains.

### rootPricer

```solidity
contract IZNSPricer rootPricer
```

Address of the `IZNSPricer` type contract that is used for root domains.

### rootPriceConfig

```solidity
bytes rootPriceConfig
```

The price config for the root domains, encoded as bytes.
This is used by the `IZNSPricer` to determine the price for root domains.

### treasury

```solidity
contract IZNSTreasury treasury
```

The `ZNSTreasury` contract that is used to handle payments and staking for domains.

### domainToken

```solidity
contract IZNSDomainToken domainToken
```

The `ZNSDomainToken` contract that is used to mint and manage domain tokens.
This contract is used to issue a token for each registered domain.

### subRegistrar

```solidity
contract IZNSSubRegistrar subRegistrar
```

The `ZNSSubRegistrar` contract that is used to handle subdomain registrations.
This contract is used to set distribution configs and manage subdomain registrations.

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address accessController_, address registry_, address rootPricer_, bytes priceConfig_, address treasury_, address domainToken_) external
```

Create an instance of the `ZNSRootRegistrar`
for registering and revoking ZNS domains

Instead of direct assignments, we are calling the setter functions
to apply Access Control and ensure only the ADMIN can set the addresses.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | Address of the ZNSAccessController contract |
| registry_ | address | Address of the ZNSRegistry contract |
| rootPricer_ | address | Address of the IZNSPricer type contract that Zero chose to use for the root domains |
| priceConfig_ | bytes | IZNSPricer pricer config data encoded as bytes for root domains |
| treasury_ | address | Address of the ZNSTreasury contract |
| domainToken_ | address | Address of the ZNSDomainToken contract |

### registerRootDomain

```solidity
function registerRootDomain(struct IZNSRootRegistrar.RootDomainRegistrationArgs args) public returns (bytes32)
```

This function is the main entry point for the Register Root Domain flow.
Registers a new root domain such as `0://zero`.
Gets domain hash as a keccak256 hash of the domain label string casted to bytes32,
checks existence of the domain in the registry and reverts if it exists.
Calls `ZNSTreasury` to do the payment, gets `tokenId` for the new token to be minted
as domain hash casted to uint256, mints the token and sets the domain data in the `ZNSRegistry`
and, possibly, `ZNSAddressResolver`. Emits a `DomainRegistered` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| args | struct IZNSRootRegistrar.RootDomainRegistrationArgs | A struct of domain registration data:       + name Name (label) of the domain to register       + domainAddress (optional) Address for the `ZNSAddressResolver` to return when requested       + tokenOwner (optional) Address to assign the domain token to (to offer domain usage without ownership)       + tokenURI URI to assign to the Domain Token issued for the domain       + distributionConfig (optional) Distribution config for the domain to set in the same tx     > Please note that passing distribution config will add more gas to the tx and most importantly -      - the `distributionConfig` HAS to be passed FULLY filled or all zeros. It is optional as a whole,      but all the parameters inside are required.       + paymentConfig (optional) Payment config for the domain to set on ZNSTreasury in the same tx      > `paymentConfig` has to be fully filled or all zeros. It is optional as a whole,      but all the parameters inside are required. |

### registerRootDomainBulk

```solidity
function registerRootDomainBulk(struct IZNSRootRegistrar.RootDomainRegistrationArgs[] args) external returns (bytes32[])
```

This function allows registering multiple root domains in a single transaction.
It iterates through an array of `SubdomainRegistrationArgs` structs, registering each domain
by calling the `registerRootDomain` function for each entry.

This function reduces the number of transactions required to register multiple domains,
saving gas and improving efficiency. Each domain registration is processed sequentially,
so order of arguments matters.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| args | struct IZNSRootRegistrar.RootDomainRegistrationArgs[] | An array of `SubdomainRegistrationArgs` structs, each containing:      + `name`: The name (label) of the domain to register.      + `domainAddress`: The address to associate with the domain in the resolver (optional).      + `tokenOwner`: The address to assign the domain token to (optional, defaults to msg.sender).      + `tokenURI`: The URI to assign to the domain token.      + `distrConfig`: The distribution configuration for the domain (optional).      + `paymentConfig`: The payment configuration for the domain (optional). |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32[] | domainHashes An array of `bytes32` hashes representing registered domains. |

### coreRegister

```solidity
function coreRegister(struct CoreRegisterArgs args) external
```

External function used by all Registrars for the final stage of registering subdomains.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| args | struct CoreRegisterArgs | `CoreRegisterArgs`: Struct containing all the arguments required to register a domain  with ZNSRootRegistrar.coreRegister():      + `parentHash`: The hash of the parent domain (0x0 for root domains)      + `domainHash`: The hash of the domain to be registered      + `isStakePayment`: A flag for whether the payment is a stake payment or not      + `domainOwner`: The address that will be set as owner in Registry record      + `tokenOwner`: The address that will be set as owner in DomainToken contract      + `domainAddress`: The address to which the domain will be resolved to      + `price`: The determined price for the domain to be registered based on parent rules      + `stakeFee`: The determined stake fee for the domain to be registered (only for PaymentType.STAKE!)      + `paymentConfig`: The payment config for the domain to be registered      + `label`: The label of the domain to be registered      + `tokenURI`: The tokenURI for the domain to be registered |

### _coreRegister

```solidity
function _coreRegister(struct CoreRegisterArgs args) internal
```

Internal function that is called by this contract to finalize the canonical registration of a domain.
This function as also called by the external `coreRegister()` function as a part of
registration of subdomains.
This function validates the domain label, checks domain existence, kicks off payment processing logic,
mints the token, sets the domain data in the `ZNSRegistry` and fires a `DomainRegistered` event.
For params see external `coreRegister()` docs.

### _processPayment

```solidity
function _processPayment(struct CoreRegisterArgs args) internal
```

Internal function that is called by this contract to finalize the payment for a domain.
Once the specific case is determined and `protocolFee` calculated, it calls `ZNSTreasury` to perform transfers.

### revokeDomain

```solidity
function revokeDomain(bytes32 domainHash) external
```

This function is the main entry point for the Revoke flow.
Revokes a domain such as `0://zero`.
Gets `tokenId` from casted domain hash to uint256, calls `ZNSDomainToken` to burn the token,
deletes the domain data from the `ZNSRegistry` and calls `ZNSTreasury` to unstake and withdraw funds
if user staked for the domain. Emits a `DomainRevoked` event.

> Note that we are not clearing the data in `ZNSAddressResolver` as it is considered not necessary
since none other contracts will have the domain data on them.
If we are not clearing `ZNSAddressResolver` state slots, we are making the next Register transaction
for the same name cheaper, since SSTORE on a non-zero slot is cheaper.
If a user wants to clear his data from `ZNSAddressResolver`, he can call `ZNSAddressResolver` directly himself
BEFORE he calls to revoke, otherwise, `ZNSRegistry` owner check will fail, since the owner there
will be 0x0 address.
> Note that in order to Revoke, a caller has to be the owner of the hash in the `ZNSRegistry`.
And that owner can revoke and burn the token even if he is NOT the owner of the token!
Ownership of the hash in Registry always overrides ownership of the token!

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
calls `ZNSTreasury` to unstake and withdraw funds user if staked for the domain. Also emits
a `DomainRevoked` event. A protocol fee will be taken on revoke if the user staked for the domain.

### assignDomainToken

```solidity
function assignDomainToken(bytes32 domainHash, address to) external
```

This function lets domain owner in Registry to transfer the token separately from any address
to any other address (except the zero address), since the Registry owner always overrides the token owner.

This is the ONLY way to transfer the token separately from the domain hash
and only Registry owner can do this! This can also be used to send the token to yourself as Registry owner
if you moved it or minted it initially to somebody else to use your domain.
Transferring the token away from yourself with this function makes the domain "controlled" in a sense
that token owner could use the domain, but not revoke it, transfer it to another address or access
domain management functions across the system.

Updates the token owner in the `ZNSDomainToken` to the "to" address and emits a `DomainTokenReassigned` event.

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

### setRootPricerAndConfig

```solidity
function setRootPricerAndConfig(address pricer_, bytes priceConfig_) public
```

Setter for the IZNSPricer type contract that Zero chooses to handle Root Domains.
Only ADMIN in `ZNSAccessController` can call this function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pricer_ | address | Address of the IZNSPricer type contract to set as pricer of Root Domains |
| priceConfig_ | bytes | The price config, encoded as bytes, for the given IZNSPricer contract |

### setRootPriceConfig

```solidity
function setRootPriceConfig(bytes priceConfig_) public
```

Set the price configuration for root domains

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceConfig_ | bytes | The price configuration for root domains, encoded as bytes,  has to match the required data type for the currently set `rootPricer` contract in state! |

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

Setter for `ZNSSubRegistrar` contract in state. Only ADMIN can call this function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| subRegistrar_ | address | Address of the `ZNSSubRegistrar` contract |

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

### _setRootPriceConfig

```solidity
function _setRootPriceConfig(contract IZNSPricer pricer_, bytes priceConfig_) internal
```

Internal function to set and validate the root price config.
Validates the price config with the current `rootPricer` and sets it in state.
Emits a `RootPriceConfigSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pricer_ | contract IZNSPricer | The IZNSPricer contract to validate the price config against |
| priceConfig_ | bytes | The price config to set, encoded as bytes |

