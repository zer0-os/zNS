// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSDomainToken } from "./IZNSDomainToken.sol";
import { AccessControlled } from "../access/AccessControlled.sol";


/**
 * @title A contract for tokenizing domains under ZNS. Every domain in ZNS has a corresponding token
 * minted at Register time. This token is also an NFT that is fully ERC-721 compliant.
 * @dev Note that all ZNS related functions on this contract can ONLY be called by either
 * the {ZNSRegistrar} contract or any address holding a REGISTRAR_ROLE.
 */
contract ZNSDomainToken is AccessControlled, UUPSUpgradeable, ERC721Upgradeable, IZNSDomainToken {

    /**
     * @notice Modifier used in functions to be called only by the {ZNSRegistrar} contract
     * or address with REGISTRAR_ROLE.
     */
    modifier onlyRegistrar {
        accessController.checkRegistrar(msg.sender);
        _;
    }

    /**
     * @notice Initializer for the {ZNSDomainToken} proxy.
     * Note that this function does NOT have role protection enforced!
     * @param accessController_ The address of the {ZNSAccessController} contract
     * @param name_ The name of the token
     * @param symbol_ The symbol of the token
     */
    function initialize(
        address accessController_,
        string memory name_,
        string memory symbol_
    ) external override initializer {
        __ERC721_init(name_, symbol_);
        _setAccessController(accessController_);
    }

    /**
     * @notice Mints a token with a specified tokenId, using _safeMint, and sends it to the given address.
     * Used ONLY as a part of the Register flow that starts from {`ZNSRegistrar.registerDomain()`}!
     * @param to The address that will recieve the newly minted domain token (new domain owner)
     * @param tokenId The TokenId that the caller wishes to mint/register. TokenId is created
     * as a hash of the domain name casted to uint256.
     */
    function register(address to, uint256 tokenId) external override onlyRegistrar {
        _safeMint(to, tokenId);
    }

    /**
     * @notice Burns the token with the specified tokenId.
     * Used ONLY as a part of the Revoke flow that starts from {`ZNSRegistrar.revokeDomain()`}!
     * @param tokenId The tokenId (as `uint256(domainHash)`) that the caller wishes to burn/revoke
     */
    function revoke(uint256 tokenId) external override onlyRegistrar {
        _burn(tokenId);
    }

    /**
     * @dev Sets the address of the {ZNSAccessController} contract.
     * Can only be called by the ADMIN. Emits an {AccessControllerSet} event.
     * @param accessController_ The address of the {ZNSAccessController} contract
     */
    function setAccessController(address accessController_)
    external
    override(AccessControlled, IZNSDomainToken)
    onlyAdmin
    {
        _setAccessController(accessController_);
    }

    /**
     * @dev Returns the address of the {ZNSAccessController} contract saved in state.
     */
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
