## ZNSDomainToken


**A contract for tokenizing domains under ZNS. Every domain in ZNS has a corresponding token
minted at register time. This token is also an NFT that is fully ERC-721 compliant.**



Note that all ZNS related functions on this contract can ONLY be called by either
the `ZNSRootRegistrar.sol` contract or any address holding a REGISTRAR_ROLE.



### constructor

```solidity
constructor() public
```







### initialize

```solidity
function initialize(address accessController_, string name_, string symbol_, address defaultRoyaltyReceiver, uint96 defaultRoyaltyFraction) external
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


### register

```solidity
function register(address to, uint256 tokenId, string _tokenURI) external
```


Mints a token with a specified tokenId, using _safeMint, and sends it to the given address.
Used ONLY as a part of the Register flow that starts from `ZNSRootRegistrar.registerRootDomain()`
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


### _burn

```solidity
function _burn(uint256 tokenId) internal
```


ERC721 `_burn` function


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token to burn |


### _baseURI

```solidity
function _baseURI() internal view returns (string)
```


Return the baseURI




### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```


To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | The implementation contract to upgrade to |



