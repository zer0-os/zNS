// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import { IERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";


interface IZNSDomainToken is IERC2981Upgradeable, IERC721Upgradeable {
    event DefaultRoyaltySet(uint96 indexed defaultRoyalty);
    event TokenRoyaltySet(uint256 indexed tokenId, uint96 indexed royalty);
    event BaseURISet(string indexed baseURI);

    function initialize(
        address accessController,
        string calldata tokenName,
        string calldata tokenSymbol,
        address defaultRoyaltyReceiver,
        uint96 defaultRoyaltyFraction
    ) external;

    function register(
        address to,
        uint256 tokenId,
        string memory _tokenURI
    ) external;

    function revoke(uint256 tokenId) external;

    function tokenURI(uint256 tokenId)
    external
    view
    returns (string memory);

    function setTokenURI(uint256 tokenId, string memory _tokenURI) external;

    function setDefaultRoyalty(address receiver, uint96 royaltyFraction) external;

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 royaltyFraction
    ) external;

    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
