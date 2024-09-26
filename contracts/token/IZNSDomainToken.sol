// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";

interface IZNSDomainToken is IERC2981, IERC721 {

    /**
     * @notice Emitted when a Default Royalty (for all tokens) is set.
    */
    event DefaultRoyaltySet(uint96 indexed defaultRoyalty);
    /**
     * @notice Emitted when Token Royalty is set for individual tokens per tokenID.
    */
    event TokenRoyaltySet(uint256 indexed tokenId, uint96 indexed royalty);
    /**
     * @notice Emitted when a Base URI is set for all tokens.
    */
    event BaseURISet(string indexed baseURI);
    /**
     * @notice Emitted when a Token URI is set for individual tokens per tokenID.
     * @dev Note that this event is fired ONLY when the tokenURI is set externally
     * through an external setter and NOT during the registration.
    */
    event TokenURISet(uint256 indexed tokenId, string indexed tokenURI);

    error CallerNotOwner(); 

    function initialize(
        address accessController,
        string calldata tokenName,
        string calldata tokenSymbol,
        address defaultRoyaltyReceiver,
        uint96 defaultRoyaltyFraction,
        address registry
    ) external;

    function totalSupply() external view returns (uint256);

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

    function setBaseURI(string memory baseURI_) external;

    function setTokenURI(uint256 tokenId, string memory _tokenURI) external;

    function setDefaultRoyalty(address receiver, uint96 royaltyFraction) external;

    function transferTokenFrom(address from, address to, uint256 tokenId) external;

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 royaltyFraction
    ) external;

    function setRegistry(address registry_) external;

    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
