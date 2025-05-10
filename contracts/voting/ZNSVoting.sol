// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import { ZeroVotingERC721 } from "./ZeroVotingERC721.sol";


contract ZNSVoting is ZeroVotingERC721 {
    constructor(
        string memory name,
        string memory symbol,
        string memory baseUri,
        string memory domainName,
        string memory domainVersion,
        address admin
    ) ZeroVotingERC721(
        name,
        symbol,
        baseUri,
        domainName,
        domainVersion,
        admin
    ) {
        __baseURI = baseUri;
    }

    function register(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) public onlyRole(MINTER_ROLE) {
        mint(to, tokenId, tokenUri);
    }

    // function mint(
    //     address to,
    //     uint256 tokenId,
    //     string memory tokenUri
    // ) public override onlyRole(MINTER_ROLE) {
    //     // TODO: registry check. Does the domain exist?
    //     // TODO: check owner against msg.sender
    //     // TODO: check if it's a child domain (subdomain)
    //     ++_totalSupply;
    //     _mint(to, tokenId);
    //     _setTokenURI(tokenId, tokenUri);
    // }
}