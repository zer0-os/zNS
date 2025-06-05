// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


contract ERC721ReceiverIncorrect {
    /**
     * @notice This function is intentionally incorrect to test the ERC721Receiver interface.
     * It should return a bytes4 value that does not match the expected interface.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        // Incorrect return value, should be 0x150b7a02 for ERC721Receiver
        return 0x12345678;
    }
}
