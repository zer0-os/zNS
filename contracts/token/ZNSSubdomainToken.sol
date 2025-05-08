// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import { ZNSDomainToken } from "./ZNSDomainToken.sol";
import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC721EnumerableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import { ERC721VotesUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721VotesUpgradeable.sol";
import { ISubdomainToken } from "./IZNSSubdomainToken.sol";


contract ZNSSubdomainToken is
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721VotesUpgradeable,
    ZNSDomainToken,
    ISubdomainToken {

    string private baseURI;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address accessController_,
        string memory name_,
        string memory symbol_,
        address defaultRoyaltyReceiver,
        uint96 defaultRoyaltyFraction,
        address registry_
    ) public override(ZNSDomainToken) initializer {
        __ERC721Votes_init();
        __ERC721Enumerable_init();

        // ZNSDomainToken
        super.initialize(
            accessController_,
            name_,
            symbol_,
            defaultRoyaltyReceiver,
            defaultRoyaltyFraction,
            registry_
        );
    }

    function tokenURI (uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ZNSDomainToken)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public 
        override(ERC721Upgradeable, IERC721, ZNSDomainToken) 
    {
        // Transfer the token
        super.transferFrom(from, to, tokenId);
    }

    function totalSupply()
        public
        view
        override(ZNSDomainToken, ERC721EnumerableUpgradeable)
        returns (uint256)
    {
        return super.totalSupply();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ZNSDomainToken)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721VotesUpgradeable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721VotesUpgradeable)
    {
        super._increaseBalance(account, value);
    }

    function _baseURI()
        internal
        view
        override (ERC721Upgradeable, ZNSDomainToken)
        returns (string memory)
    {
        return baseURI;
    }
}
