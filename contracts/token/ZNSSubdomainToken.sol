// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { ERC721Votes } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";


contract SubdomainToken is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    EIP712,
    ERC721Votes,
    ERC2981,
    ARegistryWired {

    uint256 private _totalSupply;

    string private baseURI;

    event TokenURISet(uint256 indexed tokenId, string tokenURI);

    event DefaultRoyaltySet(uint96 indexed defaultRoyalty);

    event TokenRoyaltySet(uint256 indexed tokenId, uint96 indexed royalty);

    constructor(
        string memory name_,
        string memory symbol_,
        // TODO: do we pass a version?
        string memory version_,
        address registry_,
        address accessController_
    )
        ERC721(name_, symbol_)
        EIP712(name_, version_)
    {
        _setRegistry(registry_);
    }

    function register(address to, uint256 tokenId, string memory _tokenURI)
        external
    {
        ++_totalSupply;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
    }

    function revoke(uint256 tokenId)
        external
    {
        _burn(tokenId);
        --_totalSupply;
    }

    function setTokenURI(uint256 tokenId, string memory _tokenURI)
        external
    {
        _setTokenURI(tokenId, _tokenURI);
        emit TokenURISet(tokenId, _tokenURI);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) 
        public 
        override(ERC721, IERC721) 
    {
        // Transfer the token
        super.transferFrom(from, to, tokenId);

        // TODO: make a fucntion or update existing one in the registry
        // registry.updateDomainOwner(bytes32(abi.encodePacked(tokenId)), to);
    }

    // TODO: add access control, when it's ready
    function totalSupply()
        public
        view
        override(ERC721Enumerable)
        returns (uint256)
    {
        return _totalSupply;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // TODO: add access control, when it's ready
    function setDefaultRoyalty(address receiver, uint96 royaltyFraction)
    external
    {
        _setDefaultRoyalty(receiver, royaltyFraction);

        emit DefaultRoyaltySet(royaltyFraction);
    }

    // TODO: add access control, when it's ready
    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 royaltyFraction
    )
    external
    {
        _setTokenRoyalty(tokenId, receiver, royaltyFraction);

        emit TokenRoyaltySet(tokenId, royaltyFraction);
    }

    function setRegistry(address registry_)
        external
        override(ARegistryWired)
    {
        _setRegistry(registry_);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return ERC721URIStorage.tokenURI(tokenId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable, ERC721Votes)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable, ERC721Votes)
    {
        super._increaseBalance(account, value);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
