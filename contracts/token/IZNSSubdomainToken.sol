// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISubdomainToken {
    function register(address to, uint256 tokenId, string memory _tokenURI) external;
    
    function revoke(uint256 tokenId) external;

    function setTokenURI(uint256 tokenId, string memory _tokenURI) external;

    function totalSupply() external view returns (uint256);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function setRegistry(address registry_) external;

    event TokenURISet(uint256 indexed tokenId, string indexed tokenURI);

}