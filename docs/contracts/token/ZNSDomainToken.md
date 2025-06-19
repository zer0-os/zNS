## ZNSDomainToken

**A contract for tokenizing domains under ZNS. Every domain in ZNS has a corresponding token
minted at register time. This token is an NFT that is fully ERC-721 compliant.**

Note that all ZNS related functions on this contract can ONLY be called by either
the `ZNSRootRegistrar` contract or any address holding a REGISTRAR_ROLE.
> Each indifivual domain token can ONLY be transferred by the owner of both the domain hash and the token ID,
and it will transfer both of these owners on token transfer.

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address accessController_, string name_, string symbol_, address defaultRoyaltyReceiver, uint96 defaultRoyaltyFraction, address registry_) external
```

Initializer for the `ZNSDomainToken` proxy.
Note that this function does NOT have role protection enforced!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accessController_ | address | The address of the `ZNSAccessController` contract |
| name_ | string | The name of the token |
| symbol_ | string | The symbol of the token |
| defaultRoyaltyReceiver | address | The address that will receive default royalties |
| defaultRoyaltyFraction | uint96 | The default royalty fraction (as a base of 10,000) |
| registry_ | address |  |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

Returns the total supply of all tokens

### register

```solidity
function register(address to, uint256 tokenId, string _tokenURI) external
```

Mints a token with a specified tokenId, using _safeMint, and sends it to the given address.
Used ONLY as a part of the canonical Register flow that starts from `ZNSRootRegistrar.registerRootDomain()`
or `ZNSSubRegistrar.registerSubdomain()` and sets the individual tokenURI for the token minted.
> TokenId is created as a hash of the domain name casted to uint256.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address that will recieve the newly minted domain token (new domain owner) |
| tokenId | uint256 | The TokenId that the caller wishes to mint/register. |
| _tokenURI | string | The tokenURI to be set for the token minted. |

### revoke

```solidity
function revoke(uint256 tokenId) external
```

Burns the token with the specified tokenId and removes the royalty information for this tokenID.
Used ONLY as a part of the Revoke flow that starts from `ZNSRootRegistrar.revokeDomain()`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The tokenId (as `uint256(domainHash)`) that the caller wishes to burn/revoke |

### tokenURI

```solidity
function tokenURI(uint256 tokenId) public view returns (string)
```

Returns the tokenURI for the given tokenId.

### setTokenURI

```solidity
function setTokenURI(uint256 tokenId, string _tokenURI) external
```

Sets the tokenURI for the given tokenId. This is an external setter that can only
be called by the ADMIN_ROLE of zNS. This functions is not a part of any flows and is here
only to change faulty or outdated token URIs in case of corrupted metadata or other problems.
Fires the `TokenURISet` event, which is NOT fired when tokenURI is set during the registration process.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The tokenId (as `uint256(domainHash)`) that the caller wishes to set the tokenURI for |
| _tokenURI | string | The tokenURI to be set for the token with the given tokenId |

### setBaseURI

```solidity
function setBaseURI(string baseURI_) external
```

Sets the baseURI for ALL tokens. Can only be called by the ADMIN_ROLE of zNS.
Fires the `BaseURISet` event.

This contract supports both, baseURI and individual tokenURI that can be used
interchangeably.
> Note that if `baseURI` and `tokenURI` are set, the `tokenURI` will be appended to the `baseURI`!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| baseURI_ | string | The baseURI to be set for all tokens |

### setDefaultRoyalty

```solidity
function setDefaultRoyalty(address receiver, uint96 royaltyFraction) external
```

Sets the default royalty for ALL tokens. Can only be called by the ADMIN_ROLE of zNS.
Fires the `DefaultRoyaltySet` event.

This contract supports both, default royalties and individual token royalties per tokenID.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | The address that will receive default royalties |
| royaltyFraction | uint96 | The default royalty fraction (as a base of 10,000) |

### setTokenRoyalty

```solidity
function setTokenRoyalty(uint256 tokenId, address receiver, uint96 royaltyFraction) external
```

Sets the royalty for the given tokenId. Can only be called by the ADMIN_ROLE of zNS.
Fires the `TokenRoyaltySet` event.

This contract supports both, default royalties and individual token royalties per tokenID.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The tokenId (as `uint256(domainHash)`) that the caller wishes to set the royalty for |
| receiver | address | The address that will receive royalties for the given tokenId |
| royaltyFraction | uint96 | The royalty fraction (as a base of 10,000) for the given tokenId |

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

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

To allow for user extension of the protocol we have to
enable checking acceptance of new interfaces to ensure they are supported

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| interfaceId | bytes4 | The interface ID |

### isControlled

```solidity
function isControlled(bytes32 domainHash) external view returns (bool)
```

Check if the domain (hash) is a controlled domain (has split ownership between hash and token).

Added to be used for quick verification in 3rd party apps to see if domain token can be transferred
or if domain token owner has full rights. If owners are split token can NOT be transferred in the regular way.
Only through `RootRegistrar.assignDomainToken()`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainHash | bytes32 | The hash of the domain to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if the domain owners are split |

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 tokenId) public
```

Override the standard `transferFrom` function to always update the owner for both the domain (hash)
 and the token.

Only the owner of both: hash and token can transfer the token! Same goes for transfers under approvals.
An address that owns just the token can NOT transfer, owner in Registry and this contract must be the same.
This should cover safe transfers as well since `safeTransferFrom` would call this overriden function internally.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The address that is transferring the token and the domain hash |
| to | address | The address that will receive the token and the domain |
| tokenId | uint256 | The tokenId (as `uint256(domainHash)`) that the caller wishes to transfer |

### transferOverride

```solidity
function transferOverride(address to, uint256 tokenId) external
```

A special function to allow the true domain (hash) owner in Registry to transfer the token separately
from transferring the Registry owner.

Can only be called through the entry point in `RootRegistrar.assignDomainToken()`.
This does NOT work with approvals and overrides them, since it's a system-specific function
separate from the standard transfers!
This function does NOT use `msg.sender`! It uses the owner of the domain (hash) the ultimate power to transfer
even if that owner has a different address.
Has baked-in safe transfer logic to support contracts that implement `IERC721Receiver`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address that will receive the token |
| tokenId | uint256 | The tokenId (as `uint256(domainHash)`) to transfer |

### _baseURI

```solidity
function _baseURI() internal view returns (string)
```

Return the baseURI

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal view
```

To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized

