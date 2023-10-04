## IZNSSubRegistrar


**IZNSSubRegistrar.sol - Interface for the ZNSSubRegistrar contract responsible for registering subdomains.**






### PricerContractSet

```solidity
event PricerContractSet(bytes32 domainHash, address pricerContract)
```


Emitted when a new `DistributionConfig.pricerContract` is set for a domain.




### PaymentTypeSet

```solidity
event PaymentTypeSet(bytes32 domainHash, enum IDistributionConfig.PaymentType paymentType)
```


Emitted when a new `DistributionConfig.paymentType` is set for a domain.




### AccessTypeSet

```solidity
event AccessTypeSet(bytes32 domainHash, enum IDistributionConfig.AccessType accessType)
```


Emitted when a new `DistributionConfig.accessType` is set for a domain.




### DistributionConfigSet

```solidity
event DistributionConfigSet(bytes32 domainHash, contract IZNSPricer pricerContract, enum IDistributionConfig.PaymentType paymentType, enum IDistributionConfig.AccessType accessType)
```


Emitted when a new full `DistributionConfig` is set for a domain at once.




### MintlistUpdated

```solidity
event MintlistUpdated(bytes32 domainHash, address[] candidates, bool[] allowed)
```


Emitted when a `mintlist` is updated for a domain.




### RootRegistrarSet

```solidity
event RootRegistrarSet(address registrar)
```


Emitted when the ZNSRootRegistrar address is set in state.




### distrConfigs

```solidity
function distrConfigs(bytes32 domainHash) external view returns (contract IZNSPricer pricerContract, enum IDistributionConfig.PaymentType paymentType, enum IDistributionConfig.AccessType accessType)
```







### mintlist

```solidity
function mintlist(bytes32 domainHash, address candidate) external view returns (bool)
```







### initialize

```solidity
function initialize(address _accessController, address _registry, address _rootRegistrar) external
```







### registerSubdomain

```solidity
function registerSubdomain(bytes32 parentHash, string label, address domainAddress, string tokenURI, struct IDistributionConfig.DistributionConfig configForSubdomains) external returns (bytes32)
```







### hashWithParent

```solidity
function hashWithParent(bytes32 parentHash, string label) external pure returns (bytes32)
```







### setDistributionConfigForDomain

```solidity
function setDistributionConfigForDomain(bytes32 parentHash, struct IDistributionConfig.DistributionConfig config) external
```







### setPricerContractForDomain

```solidity
function setPricerContractForDomain(bytes32 domainHash, contract IZNSPricer pricerContract) external
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







### setRegistry

```solidity
function setRegistry(address registry_) external
```







### setRootRegistrar

```solidity
function setRootRegistrar(address registrar_) external
```








