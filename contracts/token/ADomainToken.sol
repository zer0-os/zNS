// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC721URIStorageUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import { ERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";

/**
 * @title AbstractDomainToken
 * @notice Base contract for domain and subdomain tokens.
 */
abstract contract ADomainToken is ERC721URIStorageUpgradeable, ERC2981Upgradeable {
    /// @dev Total number of tokens minted
    uint256 internal _totalSupply;

    /// @dev Base URI used for metadata
    string internal baseURI;

    event BaseURISet(string newBaseURI);
    event TokenURISet(uint256 indexed tokenId, string newTokenURI);
    event DefaultRoyaltySet(uint96 royaltyFraction);
    event TokenRoyaltySet(uint256 indexed tokenId, uint96 royaltyFraction);

    /**
     * @notice Returns total number of tokens
     */
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Returns URI for a specific token
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @notice Sets the token URI manually
     */
    function setTokenURI(uint256 tokenId, string memory _tokenURI) external virtual;

    /**
     * @notice Sets base URI for all tokens
     */
    function setBaseURI(string memory baseURI_) public virtual {
        baseURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    /**
     * @notice Sets default royalty for all tokens
     */
    function setDefaultRoyalty(address receiver, uint96 royaltyFraction) external virtual {
        _setDefaultRoyalty(receiver, royaltyFraction);
        emit DefaultRoyaltySet(royaltyFraction);
    }

    /**
     * @notice Sets royalty for a specific token
     */
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 royaltyFraction) external virtual {
        _setTokenRoyalty(tokenId, receiver, royaltyFraction);
        emit TokenRoyaltySet(tokenId, royaltyFraction);
    }

    /**
     * @notice Base URI override hook
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    /**
     * @notice Required by Solidity for interface resolution
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorageUpgradeable, ERC2981Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
