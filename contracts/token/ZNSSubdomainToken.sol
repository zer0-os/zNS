// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { ERC721Votes } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract SubdomainToken is
    ERC721,
    ERC721Enumerable,
    EIP712,
    ERC721Votes,
    ARegistryWired {

    uint256 private _totalSupply;

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
        // _setTokenURI(tokenId, _tokenURI);
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

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setRegistry(address registry_)
        external
        override(ARegistryWired)
    {
        _setRegistry(registry_);
    }
}
