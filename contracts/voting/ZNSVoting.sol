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

    function mint(
        bytes32 domainHash,
        // TODO: do we pass URI?
        string memory tokenUri
    ) public override onlyRole(MINTER_ROLE) {
        require(
            registry.exists(domainHash),
            "Domain does not exist"
        );

        require(
            registry.getDomainOwner(domainHash) == msg.sender,
            "Not the owner of the domain"
        );

        super._mint(
            msg.sender,
            uint256(domainHash),
            string(abi.encodePacked(__baseURI, tokenUri))
        );
    }

    function burn(
        bytes32 domainHash
    ) public override onlyRole(BURNER_ROLE) {
        require(
            registry.exists(domainHash),
            "Domain does not exist"
        );

        require(
            registry.getDomainOwner(domainHash) == msg.sender,
            "Not the owner of the domain"
        );

        super.burn(tokenId);
    }
}