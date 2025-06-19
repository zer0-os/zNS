## AccessType

```solidity
enum AccessType {
  LOCKED,
  OPEN,
  MINTLIST
}
```

## PaymentType

```solidity
enum PaymentType {
  DIRECT,
  STAKE
}
```

## DistributionConfig

```solidity
struct DistributionConfig {
  contract IZNSPricer pricerContract;
  enum PaymentType paymentType;
  enum AccessType accessType;
  bytes priceConfig;
  address newAddress;
  uint256 newUint;
}
```

## SubdomainRegisterArgs

```solidity
struct SubdomainRegisterArgs {
  bytes32 parentHash;
  string label;
  address domainAddress;
  address tokenOwner;
  string tokenURI;
  struct DistributionConfig distrConfig;
  struct PaymentConfig paymentConfig;
}
```

## ZNSSubRegistrarMainState

### rootRegistrar

```solidity
contract IZNSRootRegistrar rootRegistrar
```

### distrConfigs

```solidity
mapping(bytes32 => struct DistributionConfig) distrConfigs
```

### Mintlist

```solidity
struct Mintlist {
  mapping(uint256 => mapping(address => bool)) list;
  uint256 ownerIndex;
}
```

### mintlist

```solidity
mapping(bytes32 => struct ZNSSubRegistrarMainState.Mintlist) mintlist
```

## ZNSSubRegistrarUpgradeMock

### ParentLockedOrDoesntExist

```solidity
error ParentLockedOrDoesntExist(bytes32 parentHash)
```

### SenderNotApprovedForPurchase

```solidity
error SenderNotApprovedForPurchase(bytes32 parentHash, address sender)
```

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
function registerSubdomain(struct SubdomainRegisterArgs regArgs) external returns (bytes32)
```

### hashWithParent

```solidity
function hashWithParent(bytes32 parentHash, string label) public pure returns (bytes32)
```

### setDistributionConfigForDomain

```solidity
function setDistributionConfigForDomain(bytes32 domainHash, struct DistributionConfig config) public
```

### setPricerDataForDomain

```solidity
function setPricerDataForDomain(bytes32 domainHash, bytes config, contract IZNSPricer pricerContract) public
```

### setPaymentTypeForDomain

```solidity
function setPaymentTypeForDomain(bytes32 domainHash, enum PaymentType paymentType) public
```

### setAccessTypeForDomain

```solidity
function setAccessTypeForDomain(bytes32 domainHash, enum AccessType accessType) public
```

### updateMintlistForDomain

```solidity
function updateMintlistForDomain(bytes32 domainHash, address[] candidates, bool[] allowed) external
```

### isMintlistedForDomain

```solidity
function isMintlistedForDomain(bytes32 domainHash, address candidate) external view returns (bool)
```

### clearMintlistForDomain

```solidity
function clearMintlistForDomain(bytes32 domainHash) public
```

### clearMintlistAndLock

```solidity
function clearMintlistAndLock(bytes32 domainHash) external
```

### setRegistry

```solidity
function setRegistry(address registry_) public
```

Virtual function to make sure the setter is always implemented in children,
otherwise we will not be able to reset the ZNSRegistry address in children

The reason this function is not implemented here is because it has to be
implemented with Access Control that only child contract is connected to.

### setRootRegistrar

```solidity
function setRootRegistrar(address registrar_) public
```

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal view
```

