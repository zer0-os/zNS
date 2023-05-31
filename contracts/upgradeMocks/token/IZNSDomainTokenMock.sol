// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";


interface IZNSDomainTokenMock is IERC721Upgradeable {
    event SetAccessAuthorization(address indexed account);
    
    function initialize(
        address accessController,
        string memory tokenName,
        string memory tokenSymbol,
        uint256 number_
    ) external;

    function register(address to, uint256 tokenId) external;

    function revoke(uint256 tokenId) external;

    function setAccessController(address accessController) external;

    function getAccessController() external view returns (address);
}
