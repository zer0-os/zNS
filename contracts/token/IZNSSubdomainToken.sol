// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISubdomainToken {
    event TokenURISet(uint256 indexed tokenId, string indexed tokenURI);

    event BaseURISet(string indexed baseURI);

    event DefaultRoyaltySet(uint96 indexed defaultRoyalty);

    event TokenRoyaltySet(uint256 indexed tokenId, uint96 indexed royalty);

    function register(address to, uint256 tokenId, string memory _tokenURI) external;
    
    function revoke(uint256 tokenId) external;

    function setTokenURI(uint256 tokenId, string memory _tokenURI) external;

    function totalSupply() external view returns (uint256);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 royaltyFraction) external;

    function setRegistry(address registry_) external;


}