## CoreRegisterArgs

Stake fee is 0x0 for anything other than subdomain under a parent with Stake Payment
parent hash will be 0x0 for root domain

```solidity
struct CoreRegisterArgs {
  bytes32 parentHash;
  bytes32 domainHash;
  bool isStakePayment;
  address domainOwner;
  address tokenOwner;
  address domainAddress;
  uint256 price;
  uint256 stakeFee;
  struct PaymentConfig paymentConfig;
  string label;
  string tokenURI;
}
```

## IZNSRootRegistrar

**IZNSRootRegistrar.sol - Interface for the ZNSRootRegistrar contract resposible for registering root domains.**

Below are docs for the types in this file:
 - `CoreRegisterArgs`: Struct containing all the arguments required to register a domain
 with ZNSRootRegistrar.coreRegister():
     + `parentHash`: The hash of the parent domain (0x0 for root domains)
     + `domainHash`: The hash of the domain to be registered
     + `isStakePayment`: A flag for whether the payment is a stake payment or not
     + `domainOwner`: The address that will be set as owner in Registry record
     + `tokenOwner`: The address that will be set as owner in DomainToken contract
     + `domainAddress`: The address to which the domain will be resolved to
     + `price`: The determined price for the domain to be registered based on parent rules
     + `stakeFee`: The determined stake fee for the domain to be registered (only for PaymentType.STAKE!)
     + `paymentConfig`: The payment config for the domain to be registered
     + `label`: The label of the domain to be registered
     + `tokenURI`: The tokenURI for the domain to be registered

### RootDomainRegistrationArgs

```solidity
struct RootDomainRegistrationArgs {
  string name;
  address domainAddress;
  address tokenOwner;
  string tokenURI;
  struct IDistributionConfig.DistributionConfig distrConfig;
  struct PaymentConfig paymentConfig;
}
```

### AlreadyTokenOwner

```solidity
error AlreadyTokenOwner(bytes32 domainHash, address currentOwner)
```

Reverted when trying to assign a token to address that is already an owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain |
| currentOwner | address | The address that is already an owner of the token |

### DomainRegistered

```solidity
event DomainRegistered(bytes32 parentHash, bytes32 domainHash, string label, uint256 tokenId, string tokenURI, address domainOwner, address tokenOwner, address domainAddress)
```

Emitted when a NEW domain is registered.

`domainAddress` parameter is the address to which a domain name will relate to in ZNS.
E.g. if a user made a domain for his wallet, the address of the wallet will be the `domainAddress`.
This can be 0 as this variable is not required to perform registration process
and can be set at a later time by the domain owner.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parentHash | bytes32 | The hash of the parent domain (0x0 for root domains) |
| domainHash | bytes32 | The hash of the domain registered |
| label | string | The name as the last part of the full domain string (level) registered |
| tokenId | uint256 | The tokenId of the domain registered |
| tokenURI | string | The tokenURI of the domain registered |
| domainOwner | address | The address became owner in Registry record |
| tokenOwner | address | The optinal address the token will be assigned to, to offer domain usage without ownership |
| domainAddress | address | The domain address of the domain registered |

### DomainRevoked

```solidity
event DomainRevoked(bytes32 domainHash, address owner, bool stakeRefunded)
```

Emitted when a domain is revoked.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain revoked |
| owner | address | The address that called `ZNSRootRegistrar.sol.revokeDomain()` and domain owner |
| stakeRefunded | bool | A flag for whether the stake was refunded or not |

### DomainTokenReassigned

```solidity
event DomainTokenReassigned(bytes32 domainHash, address newOwner)
```

Emitted when the hash (registry record) owner is sending a token to another address
through the RootRegistrar.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain reclaimed |
| newOwner | address | The address that called `ZNSRootRegistrar.reclaimDomain()` |

### RootPricerSet

```solidity
event RootPricerSet(address rootPricer, bytes priceConfig)
```

Emitted when the `rootPricer` address and the `rootPriceConfig`
values are set in state.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| rootPricer | address | The new address of any IZNSPricer type contract |
| priceConfig | bytes | The encoded bytes for the price config |

### RootPriceConfigSet

```solidity
event RootPriceConfigSet(bytes priceConfig)
```

Emitted when the `rootPriceConfig` value is set in state.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| priceConfig | bytes | The encoded bytes for the price config |

### TreasurySet

```solidity
event TreasurySet(address treasury)
```

Emitted when the `treasury` address is set in state.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| treasury | address | The new address of the Treasury contract |

### DomainTokenSet

```solidity
event DomainTokenSet(address domainToken)
```

Emitted when the `domainToken` address is set in state.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainToken | address | The new address of the DomainToken contract |

### SubRegistrarSet

```solidity
event SubRegistrarSet(address subRegistrar)
```

Emitted when the `subRegistrar` address is set in state.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| subRegistrar | address | The new address of the SubRegistrar contract |

### initialize

```solidity
function initialize(address accessController_, address registry_, address rootPricer_, bytes priceConfig_, address treasury_, address domainToken_) external
```

### registerRootDomain

```solidity
function registerRootDomain(struct IZNSRootRegistrar.RootDomainRegistrationArgs args) external returns (bytes32)
```

### registerRootDomainBulk

```solidity
function registerRootDomainBulk(struct IZNSRootRegistrar.RootDomainRegistrationArgs[] args) external returns (bytes32[])
```

### coreRegister

```solidity
function coreRegister(struct CoreRegisterArgs args) external
```

### revokeDomain

```solidity
function revokeDomain(bytes32 domainHash) external
```

### assignDomainToken

```solidity
function assignDomainToken(bytes32 domainHash, address to) external
```

### setRegistry

```solidity
function setRegistry(address registry_) external
```

### setRootPricerAndConfig

```solidity
function setRootPricerAndConfig(address rootPricer_, bytes priceConfig_) external
```

### setRootPriceConfig

```solidity
function setRootPriceConfig(bytes priceConfig_) external
```

### setTreasury

```solidity
function setTreasury(address treasury_) external
```

### setDomainToken

```solidity
function setDomainToken(address domainToken_) external
```

### setSubRegistrar

```solidity
function setSubRegistrar(address subRegistrar_) external
```

### pauseRegistration

```solidity
function pauseRegistration() external
```

### unpauseRegistration

```solidity
function unpauseRegistration() external
```

### rootPricer

```solidity
function rootPricer() external returns (contract IZNSPricer)
```

### rootPriceConfig

```solidity
function rootPriceConfig() external returns (bytes)
```

### treasury

```solidity
function treasury() external returns (contract IZNSTreasury)
```

### domainToken

```solidity
function domainToken() external returns (contract IZNSDomainToken)
```

### subRegistrar

```solidity
function subRegistrar() external returns (contract IZNSSubRegistrar)
```

