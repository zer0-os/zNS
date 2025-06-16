## ARegistrationPause

### RegistrationPauseSet

```solidity
event RegistrationPauseSet(bool isPaused)
```

Emitted when the public registration pause is set.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| isPaused | bool | The new value of the registration pause flag. |

### PublicRegistrationPaused

```solidity
error PublicRegistrationPaused()
```

Reverted when registration is paused and the caller is not an ADMIN.

### ResettingToSameValue

```solidity
error ResettingToSameValue(bool curValue)
```

Reverted when trying to set the registration pause to the same value.

### registrationPaused

```solidity
bool registrationPaused
```

Boolean flag to pause public registration of new domains.

When this flag is active, only ZNS ADMINs can register new domains.

### whenRegNotPaused

```solidity
modifier whenRegNotPaused(contract IZNSAccessController accessController)
```

Modifier to make a function publicly callable only when registration is not paused.
If registration is paused, only ADMINs can call the function.

### _setRegistrationPause

```solidity
function _setRegistrationPause(bool isPaused) internal
```

