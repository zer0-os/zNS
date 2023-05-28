// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";


interface IZNSDomainToken is IERC721Upgradeable {
    event SetAccessAuthorization(address indexed account);
    
    /**
     * @notice Initialize the ERC721 ZNSDomainToken contract with the given values
     * @param accessController The access controller contract address
     * @param tokenName The ZNS token name
     * @param tokenSymbol The ZNS token symbol
     */
    function initialize(address accessController, string calldata tokenName, string calldata tokenSymbol) external;

    /**
     * @notice Mints a token with a specified tokenId, using _safeMint, and sends it to the given address
     * @param to The address that will recieve the newly minted domain token
     * @param tokenId The TokenId that the caller wishes to mint/register
     */
    function register(address to, uint256 tokenId) external;

    /**
     * @notice Burns the token with the specified tokenId
     * @dev TODO: Add onlyRole(REGISTRAR_ROLE)
     * @param tokenId The tokenId that the caller wishes to burn/revoke
     */
    function revoke(uint256 tokenId) external;

    function setAccessController(address accessController) external;

    function getAccessController() external view returns (address);
}
