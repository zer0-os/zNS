// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { ERC721URIStorageUpgradeable }
    from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import { IZNSDomainToken } from "./IZNSDomainToken.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";


/**
 * @title A contract for tokenizing domains under ZNS. Every domain in ZNS has a corresponding token
 * minted at register time. This token is also an NFT that is fully ERC-721 compliant.
 * @dev Note that all ZNS related functions on this contract can ONLY be called by either
 * the `ZNSRootRegistrar.sol` contract or any address holding a REGISTRAR_ROLE.
 */
contract ZNSDomainToken is
    AAccessControlled,
    ERC721URIStorageUpgradeable,
    ERC2981Upgradeable,
    UUPSUpgradeable,
    ARegistryWired,
    IZNSDomainToken {

    /**
     * @notice Base URI used for ALL tokens. Can be empty if individual URIs are set.
    */
    string private baseURI;

    /**
     * @dev Total supply of all tokens
     */
    uint256 private _totalSupply;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializer for the `ZNSDomainToken` proxy.
     * Note that this function does NOT have role protection enforced!
     * @param accessController_ The address of the `ZNSAccessController` contract
     * @param name_ The name of the token
     * @param symbol_ The symbol of the token
     * @param defaultRoyaltyReceiver The address that will receive default royalties
     * @param defaultRoyaltyFraction The default royalty fraction (as a base of 10,000)
     */
    function initialize(
        address accessController_,
        string memory name_,
        string memory symbol_,
        address defaultRoyaltyReceiver,
        uint96 defaultRoyaltyFraction,
        address registry_
    ) external override initializer {
        __ERC721_init(name_, symbol_);
        _setAccessController(accessController_);
        _setDefaultRoyalty(defaultRoyaltyReceiver, defaultRoyaltyFraction);
        _setRegistry(registry_);
    }

    /**
     * @notice Returns the total supply of all tokens
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Mints a token with a specified tokenId, using _safeMint, and sends it to the given address.
     * Used ONLY as a part of the Register flow that starts from `ZNSRootRegistrar.registerRootDomain()`
     * or `ZNSSubRegistrar.registerSubdomain()` and sets the individual tokenURI for the token minted.
     * > TokenId is created as a hash of the domain name casted to uint256.
     * @param to The address that will recieve the newly minted domain token (new domain owner)
     * @param tokenId The TokenId that the caller wishes to mint/register.
     * @param _tokenURI The tokenURI to be set for the token minted.
     */
    function register(address to, uint256 tokenId, string memory _tokenURI) external override onlyRegistrar {
        ++_totalSupply;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
    }

    /**
     * @notice Burns the token with the specified tokenId and removes the royalty information for this tokenID.
     * Used ONLY as a part of the Revoke flow that starts from `ZNSRootRegistrar.revokeDomain()`.
     * @param tokenId The tokenId (as `uint256(domainHash)`) that the caller wishes to burn/revoke
     */
    function revoke(uint256 tokenId) external override onlyRegistrar {
        _burn(tokenId);
        --_totalSupply;
        _resetTokenRoyalty(tokenId);
    }

    /**
     * @notice Returns the tokenURI for the given tokenId.
    */
    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721URIStorageUpgradeable, IZNSDomainToken)
    returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**
     * @notice Sets the tokenURI for the given tokenId. This is an external setter that can only
     * be called by the ADMIN_ROLE of zNS. This functions is not a part of any flows and is here
     * only to change faulty or outdated token URIs in case of corrupted metadata or other problems.
     * Fires the `TokenURISet` event, which is NOT fired when tokenURI is set during the registration process.
     * @param tokenId The tokenId (as `uint256(domainHash)`) that the caller wishes to set the tokenURI for
     * @param _tokenURI The tokenURI to be set for the token with the given tokenId
    */
    function setTokenURI(uint256 tokenId, string memory _tokenURI) external override onlyAdmin {
        _setTokenURI(tokenId, _tokenURI);
        emit TokenURISet(tokenId, _tokenURI);
    }

    /**
     * @notice Sets the baseURI for ALL tokens. Can only be called by the ADMIN_ROLE of zNS.
     * Fires the `BaseURISet` event.
     * @dev This contract supports both, baseURI and individual tokenURI that can be used
     * interchangeably.
     * > Note that if `baseURI` and `tokenURI` are set, the `tokenURI` will be appended to the `baseURI`!
     * @param baseURI_ The baseURI to be set for all tokens
    */
    function setBaseURI(string memory baseURI_) external override onlyAdmin {
        baseURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    /**
     * @notice Sets the default royalty for ALL tokens. Can only be called by the ADMIN_ROLE of zNS.
     * Fires the `DefaultRoyaltySet` event.
     * @dev This contract supports both, default royalties and individual token royalties per tokenID.
     * @param receiver The address that will receive default royalties
     * @param royaltyFraction The default royalty fraction (as a base of 10,000)
    */
    function setDefaultRoyalty(address receiver, uint96 royaltyFraction) external override onlyAdmin {
        _setDefaultRoyalty(receiver, royaltyFraction);

        emit DefaultRoyaltySet(royaltyFraction);
    }

    /**
     * @notice Sets the royalty for the given tokenId. Can only be called by the ADMIN_ROLE of zNS.
     * Fires the `TokenRoyaltySet` event.
     * @dev This contract supports both, default royalties and individual token royalties per tokenID.
     * @param tokenId The tokenId (as `uint256(domainHash)`) that the caller wishes to set the royalty for
     * @param receiver The address that will receive royalties for the given tokenId
     * @param royaltyFraction The royalty fraction (as a base of 10,000) for the given tokenId
    */
    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 royaltyFraction
    ) external override onlyAdmin {
        _setTokenRoyalty(tokenId, receiver, royaltyFraction);

        emit TokenRoyaltySet(tokenId, royaltyFraction);
    }

    /**
     * @notice Setter function for the `ZNSRegistry` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param registry_ Address of the `ZNSRegistry` contract
     */
    function setRegistry(address registry_) public override(ARegistryWired, IZNSDomainToken) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice To allow for user extension of the protocol we have to
     * enable checking acceptance of new interfaces to ensure they are supported
     * @param interfaceId The interface ID
     */
    function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(ERC721URIStorageUpgradeable, ERC2981Upgradeable, IZNSDomainToken)
    returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice We override the standard transfer function to update the owner for both the `registry` and `token`
     * This non-standard transfer is to behave similarly to the default transfer that only updates the `token`
     * 
     * @param from Owner of the token
     * @param to Address to send the token to
     * @param tokenId The token being transferred
     */
    function updateTokenOwner(address from, address to, uint256 tokenId) public override {
        super.transferFrom(from, to, tokenId);
    }

    /**
     * @notice Override the standard transferFrom function to update the owner for both the `registry` and `token`
     * 
     * @dev See {IERC721-transferFrom}
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721Upgradeable, IERC721) {
        // Transfer the token
        super.transferFrom(from, to, tokenId);
        
        // Update the registry
        // because `_transfer` already checks for `to == address(0)` we don't need to check it here
        // We `encodePacked` here to ensure that any values that result in leading zeros are converted correctly
        registry.updateDomainOwner(bytes32(abi.encodePacked(tokenId)), to);
    }

    /**
     * @notice Return the baseURI
     */
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
