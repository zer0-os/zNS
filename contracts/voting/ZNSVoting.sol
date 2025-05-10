// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import { ZeroVotingERC721 } from "./ZeroVotingERC721.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";


contract ZNSVoting is ZeroVotingERC721, ARegistryWired {
    constructor(
        string memory name,
        string memory symbol,
        string memory baseUri,
        string memory domainName,
        string memory domainVersion,
        address admin,
        address registry
    ) ZeroVotingERC721(
        name,
        symbol,
        baseUri,
        domainName,
        domainVersion,
        admin
    ) {
        _setRegistry(registry_);
        __baseURI = baseUri;
    }

    function register(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) public onlyRole(MINTER_ROLE) {
        // TODO: registry check. Does the domain exist?
        // TODO: check owner against msg.sender
        // TODO: check if it's a child domain (subdomain)
        registry.exists(
            domainHash
        );
        registry.getDomainOwner(
            domainHash
        );


        registry.createDomainRecord(
            domainHash,
            msg.sender,
            "string"
        );
        mint(to, tokenId, tokenUri);
    }

    function mint(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) public override onlyRole(MINTER_ROLE) {}
}