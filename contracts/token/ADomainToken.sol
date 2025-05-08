// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


abstract contract ADomainToken {
    /**
     * @notice Base URI used for ALL tokens. Can be empty if individual URIs are set.
    */
    string private baseURI;

    /**
     * @dev Total supply of all tokens
     */
    uint256 private _totalSupply;

    /**
     * @notice Returns the total supply of all tokens
     */
    function totalSupply() public view virtual returns (uint256);

    /**
     * @notice Returns the token URI for a given tokenId
     * @param tokenId The ID of the token
     */
    function tokenURI(uint256 tokenId) public view virtual returns (string memory);

    /**
     * @notice Sets the base URI for all tokens
     * @param baseURI_ The new base URI
     */
    function setBaseURI(string memory baseURI_) public virtual;

    /**
     * @notice Checks if the contract supports a specific interface
     * @param interfaceId The ID of the interface
     */
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool);
}