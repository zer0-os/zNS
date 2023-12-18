## ARegistryWired

**ARegistryWired.sol - Abstract contract, intdroducing ZNSRegistry to the storage
of children contracts. Inheriting this contract means that child is connected to ZNSRegistry
and is able to get AC and domain data from it or write to it.**

### RegistrySet

```solidity
event RegistrySet(address registry)
```

Emitted when the ZNSRegistry address is set in state of the child contract.

### registry

```solidity
contract IZNSRegistry registry
```

ZNSRegistry address in the state of the child contract.

### onlyOwnerOrOperator

```solidity
modifier onlyOwnerOrOperator(bytes32 domainHash)
```

### _setRegistry

```solidity
function _setRegistry(address registry_) internal
```

Internal function to set the ZNSRegistry address in the state of the child contract.

### setRegistry

```solidity
function setRegistry(address registry_) external virtual
```

Virtual function to make sure the setter is always implemented in children,
otherwise we will not be able to reset the ZNSRegistry address in children

The reason this function is not implemented here is because it has to be
implemented with Access Control that only child contract is connected to.

