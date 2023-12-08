## CoreRegisterArgs

```solidity
struct CoreRegisterArgs {
  bytes32 parentHash;
  bytes32 domainHash;
  address registrant;
  address domainAddress;
  uint256 price;
  uint256 stakeFee;
  string label;
  string tokenURI;
  bool isStakePayment;
  struct PaymentConfig paymentConfig;
}
```

## IZNSRootRegistrar

**IZNSRootRegistrar.sol - Interface for the ZNSRootRegistrar contract resposible for registering root domains.**

Below are docs for the types in this file:
 - `OwnerOf`: Enum signifying ownership of ZNS entities
     + NAME: The owner of the Name only
     + TOKEN: The owner of the Token only
     + BOTH: The owner of both the Name and the Token
 - `CoreRegisterArgs`: Struct containing all the arguments required to register a domain
 with ZNSRootRegistrar.coreRegister():
     + `parentHash`: The hash of the parent domain (0x0 for root domains)
     + `domainHash`: The hash of the domain to be registered
     + `label`: The label of the domain to be registered
     + `registrant`: The address of the user who is registering the domain
     + `price`: The determined price for the domain to be registered based on parent rules
     + `stakeFee`: The determined stake fee for the domain to be registered (only for PaymentType.STAKE!)
     + `domainAddress`: The address to which the domain will be resolved to
     + `tokenURI`: The tokenURI for the domain to be registered
     + `isStakePayment`: A flag for whether the payment is a stake payment or not

### OwnerOf

```solidity
enum OwnerOf {
  NAME,
  TOKEN,
  BOTH
}
```

### DomainRegistered

```solidity
event DomainRegistered(bytes32 parentHash, bytes32 domainHash, uint256 tokenId, string label, address registrant, address domainAddress)
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
| tokenId | uint256 | The tokenId of the domain registered |
| label | string | The name as the last part of the full domain string (level) registered |
| registrant | address | The address that called `ZNSRootRegistrar.registerRootDomain()` |
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

### DomainReclaimed

```solidity
event DomainReclaimed(bytes32 domainHash, address registrant)
```

Emitted when an ownership of the Name is reclaimed by the Token owner.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain reclaimed |
| registrant | address | The address that called `ZNSRootRegistrar.sol.reclaimDomain()` |

### RootPricerSet

```solidity
event RootPricerSet(address rootPricer)
```

Emitted when the `rootPricer` address is set in state.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| rootPricer | address | The new address of any IZNSPricer type contract |

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
function initialize(address accessController_, address registry_, address rootPricer_, address treasury_, address domainToken_) external
```

### registerRootDomain

```solidity
function registerRootDomain(string name, address domainAddress, string tokenURI, struct IDistributionConfig.DistributionConfig distributionConfig, struct PaymentConfig paymentConfig) external returns (bytes32)
```

### coreRegister

```solidity
function coreRegister(struct CoreRegisterArgs args) external
```

### revokeDomain

```solidity
function revokeDomain(bytes32 domainHash) external
```

### reclaimDomain

```solidity
function reclaimDomain(bytes32 domainHash) external
```

### isOwnerOf

```solidity
function isOwnerOf(bytes32 domainHash, address candidate, enum IZNSRootRegistrar.OwnerOf ownerOf) external view returns (bool)
```

### setRegistry

```solidity
function setRegistry(address registry_) external
```

### setRootPricer

```solidity
function setRootPricer(address rootPricer_) external
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

