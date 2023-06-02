// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSDomainToken } from "./IZNSDomainToken.sol";
import { AccessControlled } from "../access/AccessControlled.sol";


/**
 * @title A contract for tokenizing domains under ZNS
 */
contract ZNSDomainToken is AccessControlled, UUPSUpgradeable, ERC721Upgradeable, IZNSDomainToken {

    modifier onlyRegistrar {
        accessController.checkRegistrar(msg.sender);
        _;
    }

    function initialize(
        address accessController,
        string memory tokenName,
        string memory tokenSymbol
    ) external override initializer {
        __ERC721_init(tokenName, tokenSymbol);
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

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The implementation contract to upgrade to
     */
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
