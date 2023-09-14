// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import { IERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";


interface IZNSDomainToken is IERC2981Upgradeable, IERC721Upgradeable {
    event DefaultRoyaltySet(uint96 indexed defaultRoyalty);
    event TokenRoyaltySet(uint256 indexed tokenId, uint96 indexed royalty);

    function initialize(address accessController, string calldata tokenName, string calldata tokenSymbol) external;

    function register(address to, uint256 tokenId) external;

    function revoke(uint256 tokenId) external;

    function setDefaultRoyalty(address receiver, uint96 royaltyFraction) external;

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 royaltyFraction
    ) external;

    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
