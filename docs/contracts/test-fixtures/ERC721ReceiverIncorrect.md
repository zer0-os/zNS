## ERC721ReceiverIncorrect

### onERC721Received

```solidity
function onERC721Received(address, address, uint256, bytes) external pure returns (bytes4)
```

This function is intentionally incorrect to test the ERC721Receiver interface.
It should return a bytes4 value that does not match the expected interface.

