## AAccessControlled

**This abstract contract outlines basic functionality, declares functions
that need to be implemented to provide a deterministic connection to `ZNSAccessController` module.**

In order to connect an arbitrary module to `ZNSAccessController` and it's functionality,
this contract needs to be inherited by the module.

### AccessControllerSet

```solidity
event AccessControllerSet(address accessController)
```

Emitted when the access controller contract address is set.

### WrongAccessControllerAddress

```solidity
error WrongAccessControllerAddress(address accessController)
```

Reverts when the access controller is set to an incorrect address.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController | address | The address that was attempted to be set as the access controller. |

### accessController

```solidity
contract IZNSAccessController accessController
```

Address of the `ZNSAccessController` contract.

### onlyAdmin

```solidity
modifier onlyAdmin()
```

Modifier to make a function callable only when caller is an admin.
Implemented here to avoid declaring this in every single contract that uses it.

### onlyRegistrar

```solidity
modifier onlyRegistrar()
```

Revert if `msg.sender` is not the `ZNSRootRegistrar.sol` contract
or an address holding REGISTRAR_ROLE.

### getAccessController

```solidity
function getAccessController() external view returns (address)
```

Universal getter for `accessController` address on any contract that
inherits from `AAccessControlled`.

### setAccessController

```solidity
function setAccessController(address accessController_) external
```

Universal setter for `accessController` address on any contract that
inherits from `AAccessControlled`.
Only ADMIN can call this function.
Fires `AccessControllerSet` event.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the new access controller |

### _setAccessController

```solidity
function _setAccessController(address _accessController) internal
```

Internal function to set the access controller address.

This function checks if the caller has the admin role in the current
in-state contract and checks if the new access controller address passed is in fact a `ZNSAccessController`
contract that is already set up with the same caller as an admin. This prevents from setting the wrong address.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _accessController | address | Address of the ZNSAccessController contract. |

