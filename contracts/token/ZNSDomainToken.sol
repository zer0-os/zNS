// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import { ERC721URIStorageUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import { IZNSDomainToken } from "./IZNSDomainToken.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";


/**
 * @title A contract for tokenizing domains under ZNS. Every domain in ZNS has a corresponding token
 * minted at Register time. This token is also an NFT that is fully ERC-721 compliant.
 * @dev Note that all ZNS related functions on this contract can ONLY be called by either
 * the `ZNSRootRegistrar.sol` contract or any address holding a REGISTRAR_ROLE.
 */
contract ZNSDomainToken is
    AAccessControlled,
    ERC721Upgradeable,
    ERC2981Upgradeable,
    ERC721URIStorageUpgradeable,
    UUPSUpgradeable,
    IZNSDomainToken {

    string private baseURI;

    /**
     * @notice Initializer for the `ZNSDomainToken` proxy.
     * Note that this function does NOT have role protection enforced!
     * @param accessController_ The address of the `ZNSAccessController` contract
     * @param name_ The name of the token
     * @param symbol_ The symbol of the token
     */
    function initialize(
        address accessController_,
        string memory name_,
        string memory symbol_,
        address defaultRoyaltyReceiver,
        uint96 defaultRoyaltyFraction
    ) external override initializer {
        __ERC721_init(name_, symbol_);
        _setAccessController(accessController_);
        _setDefaultRoyalty(defaultRoyaltyReceiver, defaultRoyaltyFraction);
    }

    /**
     * @notice Mints a token with a specified tokenId, using _safeMint, and sends it to the given address.
     * Used ONLY as a part of the Register flow that starts from ``ZNSRootRegistrar.sol.registerDomain()``!
     * > TokenId is created as a hash of the domain name casted to uint256.
     * @param to The address that will recieve the newly minted domain token (new domain owner)
     * @param tokenId The TokenId that the caller wishes to mint/register.
     */
    function register(address to, uint256 tokenId, string memory _tokenURI) external override onlyRegistrar {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
    }

    /**
     * @notice Burns the token with the specified tokenId.
     * Used ONLY as a part of the Revoke flow that starts from `ZNSRootRegistrar.revokeDomain()`!
     * @param tokenId The tokenId (as `uint256(domainHash)`) that the caller wishes to burn/revoke
     */
    // TODO sub: change to "burn" ???!!!
    function revoke(uint256 tokenId) external override onlyRegistrar {
        _burn(tokenId);
        _resetTokenRoyalty(tokenId);
    }

    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721Upgradeable, ERC721URIStorageUpgradeable, IZNSDomainToken)
    returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function setTokenURI(uint256 tokenId, string memory _tokenURI) external override onlyAdmin {
        _setTokenURI(tokenId, _tokenURI);
    }

    function setBaseURI(string memory _baseURI) external onlyAdmin {
        baseURI = _baseURI;
        emit BaseURISet(_baseURI);
    }

    function setDefaultRoyalty(address receiver, uint96 royaltyFraction) external override onlyAdmin {
        _setDefaultRoyalty(receiver, royaltyFraction);

        emit DefaultRoyaltySet(royaltyFraction);
    }

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 royaltyFraction
    ) external override onlyAdmin {
        _setTokenRoyalty(tokenId, receiver, royaltyFraction);

        emit TokenRoyaltySet(tokenId, royaltyFraction);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(ERC721Upgradeable, ERC2981Upgradeable, IZNSDomainToken)
    returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId)
    internal
    override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    {
        super._burn(tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
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
