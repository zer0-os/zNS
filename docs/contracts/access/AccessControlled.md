## AccessControlled


**This abstract contract outlines basic functionality, declares functions
that need to be implemented to provide a deterministic connection to `ZNSAccessController` module.**



In order to connect an arbitrary module to `ZNSAccessController` and it's functionality,
this contract needs to be inherited by the module.



### AccessControllerSet

```solidity
event AccessControllerSet(address accessController)
```


Emitted when the access controller contract address is set.




### accessController

```solidity
contract IZNSAccessController accessController
```


Address of the ZNSAccessController contract.




### onlyAdmin

```solidity
modifier onlyAdmin()
```


Modifier to make a function callable only when caller is an admin.
Implemented here to avoid declaring this in every single contract that uses it.




### getAccessController

```solidity
function getAccessController() external view virtual returns (address)
```


Virtual function to make sure the getter is always implemented in children,
otherwise we will not be able to read the AC address in children




### setAccessController

```solidity
function setAccessController(address _accessController) external virtual
```


Virtual function to make sure the setter is always implemented in children,
otherwise we will not be able to reset the AC address in children




### _setAccessController

```solidity
function _setAccessController(address _accessController) internal
```


Internal function to set the access controller address.


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _accessController | address | Address of the ZNSAccessController contract. |



