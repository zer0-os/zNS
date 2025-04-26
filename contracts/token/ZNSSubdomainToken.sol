// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { ERC721Votes } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";


contract SubdomainToken is AAccessControlled, ARegistryWired, ERC721Enumerable, ERC721Votes {
    constructor(
      address registry_,
      address accessController_
    )
        ERC721("SubdomainToken", "SUBD")
        EIP712("SubdomainToken", "1")
    {
        _setAccessController(_accessController);
        _setRegistry(registry_);
    }

    modifier whenRegisterIsOpen() {
      // find the param
    }

    function createSubdomainToken(string calldata subdomain) external whenRegisterIsOpen {
        // chech if the subdomain is already registered
        bytes32 subdomainHash = keccak256(abi.encodePacked(subdomain));
        require(
          !IZNSRegistry(registry_).getDomainRecord(subdomainHash),
          "Subdomain already registered"
        );

        // Who will be the owner of the token?
        // _mint(toParam, newTokenId);
        // _mint(this.address, newTokenId);
        // _mint(msg.sender, newTokenId);

        // _delegate(rootOwner?, or SubOwner?);

        // register using the subdomain registrar
        // ?
        // IZNSSubRegistrar(subRegistrar).registerSubdomain(to, subdomain, newTokenId);
    }

    function _afterTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal override(ERC721, ERC721Votes)
    {
        super._afterTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721Votes) {
        super._burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
