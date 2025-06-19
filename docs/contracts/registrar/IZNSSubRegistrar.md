## IZNSSubRegistrar

**IZNSSubRegistrar.sol - Interface for the ZNSSubRegistrar contract responsible for registering subdomains.**

### SubdomainRegisterArgs

```solidity
struct SubdomainRegisterArgs {
  bytes32 parentHash;
  address domainAddress;
  address tokenOwner;
  string tokenURI;
  struct IDistributionConfig.DistributionConfig distrConfig;
  struct PaymentConfig paymentConfig;
  string label;
}
```

### ParentLockedOrDoesntExist

```solidity
error ParentLockedOrDoesntExist(bytes32 parentHash)
```

Reverted when someone other than parent owner is trying to buy
a subdomain under the parent that is locked
or when the parent provided does not exist.

### SenderNotApprovedForPurchase

```solidity
error SenderNotApprovedForPurchase(bytes32 parentHash, address sender)
```

Reverted when the buyer of subdomain is not approved by the parent in it's mintlist.

### ZeroParentHash

```solidity
error ZeroParentHash(string label)
```

Reverted when the subdomain is nested and doesn't have `parentHash`. Attaches a domain label.

### PricerDataSet

```solidity
event PricerDataSet(bytes32 domainHash, bytes priceConfig, address pricerContract)
```

Emitted when a new `DistributionConfig.pricerContract` is set for a domain.

### MintlistUpdated

```solidity
event MintlistUpdated(bytes32 domainHash, uint256 ownerIndex, address[] candidates, bool[] allowed)
```

Emitted when a `mintlist` is updated for a domain.

### MintlistCleared

```solidity
event MintlistCleared(bytes32 domainHash)
```

### RootRegistrarSet

```solidity
event RootRegistrarSet(address registrar)
```

Emitted when the `ZNSRootRegistrar` address is set in state.

### initialize

```solidity
function initialize(address _accessController, address _registry, address _rootRegistrar) external
```

### distrConfigs

```solidity
function distrConfigs(bytes32 domainHash) external view returns (contract IZNSPricer pricerContract, enum IDistributionConfig.PaymentType paymentType, enum IDistributionConfig.AccessType accessType, bytes priceConfig)
```

### registerSubdomain

```solidity
function registerSubdomain(struct IZNSSubRegistrar.SubdomainRegisterArgs registration) external returns (bytes32)
```

### registerSubdomainBulk

```solidity
function registerSubdomainBulk(struct IZNSSubRegistrar.SubdomainRegisterArgs[] args) external returns (bytes32[])
```

### setDistributionConfigForDomain

```solidity
function setDistributionConfigForDomain(bytes32 parentHash, struct IDistributionConfig.DistributionConfig config) external
```

### setPricerDataForDomain

```solidity
function setPricerDataForDomain(bytes32 domainHash, bytes priceConfig, contract IZNSPricer pricerContract) external
```

### setPaymentTypeForDomain

```solidity
function setPaymentTypeForDomain(bytes32 domainHash, enum IDistributionConfig.PaymentType paymentType) external
```

### setAccessTypeForDomain

```solidity
function setAccessTypeForDomain(bytes32 domainHash, enum IDistributionConfig.AccessType accessType) external
```

### updateMintlistForDomain

```solidity
function updateMintlistForDomain(bytes32 domainHash, address[] candidates, bool[] allowed) external
```

### clearMintlistForDomain

```solidity
function clearMintlistForDomain(bytes32 domainHash) external
```

### clearMintlistAndLock

```solidity
function clearMintlistAndLock(bytes32 domainHash) external
```

### setRegistry

```solidity
function setRegistry(address registry_) external
```

### setRootRegistrar

```solidity
function setRootRegistrar(address registrar_) external
```

### isMintlistedForDomain

```solidity
function isMintlistedForDomain(bytes32 domainHash, address candidate) external view returns (bool)
```

### hashWithParent

```solidity
function hashWithParent(bytes32 parentHash, string label) external pure returns (bytes32)
```

### pauseRegistration

```solidity
function pauseRegistration() external
```

### unpauseRegistration

```solidity
function unpauseRegistration() external
```

### rootRegistrar

```solidity
function rootRegistrar() external returns (contract IZNSRootRegistrar)
```

