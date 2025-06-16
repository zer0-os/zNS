## IZNSDomainToken

### DefaultRoyaltySet

```solidity
event DefaultRoyaltySet(uint96 defaultRoyalty)
```

Emitted when a Default Royalty (for all tokens) is set.

### TokenRoyaltySet

```solidity
event TokenRoyaltySet(uint256 tokenId, uint96 royalty)
```

Emitted when Token Royalty is set for individual tokens per tokenID.

### BaseURISet

```solidity
event BaseURISet(string baseURI)
```

Emitted when a Base URI is set for all tokens.

### TokenURISet

```solidity
event TokenURISet(uint256 tokenId, string tokenURI)
```

Emitted when a Token URI is set for individual tokens per tokenID.

Note that this event is fired ONLY when the tokenURI is set externally
through an external setter and NOT during the registration.

### OverrideTransfer

```solidity
event OverrideTransfer(address from, address to, uint256 tokenId)
```

Emitted when doing an override transfer of the token separately from the domain hash.

### CannotBurnToken

```solidity
error CannotBurnToken()
```

Revert when trying to burn the token separately from domain revocation.

### initialize

```solidity
function initialize(address accessController, string tokenName, string tokenSymbol, address defaultRoyaltyReceiver, uint96 defaultRoyaltyFraction, address registry) external
```

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### isControlled

```solidity
function isControlled(bytes32 domainHash) external view returns (bool)
```

### register

```solidity
function register(address to, uint256 tokenId, string _tokenURI) external
```

### revoke

```solidity
function revoke(uint256 tokenId) external
```

### transferOverride

```solidity
function transferOverride(address to, uint256 tokenId) external
```

### tokenURI

```solidity
function tokenURI(uint256 tokenId) external view returns (string)
```

### setBaseURI

```solidity
function setBaseURI(string baseURI_) external
```

### setTokenURI

```solidity
function setTokenURI(uint256 tokenId, string _tokenURI) external
```

### setDefaultRoyalty

```solidity
function setDefaultRoyalty(address receiver, uint96 royaltyFraction) external
```

### setTokenRoyalty

```solidity
function setTokenRoyalty(uint256 tokenId, address receiver, uint96 royaltyFraction) external
```

### setRegistry

```solidity
function setRegistry(address registry_) external
```

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```

Returns true if this contract implements the interface defined by
`interfaceId`. See the corresponding
https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
to learn more about how these ids are created.

This function call must use less than 30 000 gas.

