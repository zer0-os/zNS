// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IZNSDomainToken } from "./IZNSDomainToken.sol";
import { AccessControlled } from "../access/AccessControlled.sol";


/**
 * @title A contract for tokenizing domains under ZNS
 */
contract ZNSDomainToken is AccessControlled, ERC721, IZNSDomainToken {

    modifier onlyRegistrar() {
        accessController.checkRegistrar(msg.sender);
        _;
    }


    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        address accessController
    ) ERC721(tokenName, tokenSymbol) {
        _setAccessController(accessController);
    }

    /**
     * @notice Mints a token with a specified tokenId, using _safeMint, and sends it to the given address
     * @param to The address that will recieve the newly minted domain token
     * @param tokenId The TokenId that the caller wishes to mint/register
     */
    function register(address to, uint256 tokenId) external override onlyRegistrar {
        _safeMint(to, tokenId);
    }

    /**
     * @notice Burns the token with the specified tokenId
     * @param tokenId The tokenId that the caller wishes to burn/revoke
     */
    function revoke(uint256 tokenId) external override onlyRegistrar {
        _burn(tokenId);
    }

    function setAccessController(address accessController)
    external
    override(AccessControlled, IZNSDomainToken)
    onlyAdmin
    {
        _setAccessController(accessController);
    }

    function getAccessController() external view override(AccessControlled, IZNSDomainToken) returns (address) {
        return address(accessController);
    }
}
