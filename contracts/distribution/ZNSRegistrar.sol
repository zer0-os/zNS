// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSRegistrar } from "./IZNSRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSAddressResolver } from "../resolver/IZNSAddressResolver.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSSubdomainRegistrar } from "./subdomains/IZNSSubdomainRegistrar.sol";
import { ARegistryWired } from "../abstractions/ARegistryWired.sol";
import { AZNSPricing } from "./subdomains/abstractions/AZNSPricing.sol";


/**
 * @title Main entry point for the three main flows of ZNS - Register, Reclaim and Revoke a domain.
 * @notice This contract serves as the "umbrella" for many ZNS operations, it is given REGISTRAR_ROLE
 * to combine multiple calls/operations between different modules to achieve atomic state changes
 * and proper logic for the ZNS flows. You can see functions in other modules that are only allowed
 * to be called by this contract to ensure proper management of ZNS data in multiple places.
 * RRR - Register, Reclaim, Revoke start here and then call other modules to complete the flow.
 * ZNSRegistrar stores most of the other contract addresses and can communicate with other modules,
 * but the relationship is one-sided, where other modules do not need to know about the ZNSRegistrar,
 * they only check REGISTRAR_ROLE that can, in theory, be assigned to any other address.
 */
// TODO sub: change name to ZNSRootRegistrar possibly !
contract ZNSRegistrar is
    UUPSUpgradeable,
    AAccessControlled,
    ARegistryWired,
    IZNSRegistrar {

    IZNSTreasury public treasury;
    IZNSDomainToken public domainToken;
    IZNSAddressResolver public addressResolver;
    IZNSSubdomainRegistrar public subdomainRegistrar;

    /**
     * @notice Create an instance of the ZNSRegistrar
     * for registering, reclaiming and revoking ZNS domains
     * @dev Instead of direct assignments, we are calling the setter functions
     * to apply Access Control and ensure only the ADMIN can set the addresses.
     * @param accessController_ Address of the ZNSAccessController contract
     * @param registry_ Address of the ZNSRegistry contract
     * @param treasury_ Address of the ZNSTreasury contract
     * @param domainToken_ Address of the ZNSDomainToken contract
     * @param addressResolver_ Address of the ZNSAddressResolver contract
     */
    function initialize(
        address accessController_,
        address registry_,
        address treasury_,
        address domainToken_,
        address addressResolver_
    ) public override initializer {
        _setAccessController(accessController_);
        setRegistry(registry_);
        setTreasury(treasury_);
        setDomainToken(domainToken_);
        setAddressResolver(addressResolver_);
    }

    /**
     * @notice This function is the main entry point for the Register flow.
     * Registers a new domain such as `0://wilder`.
     * Gets domain hash as a keccak256 hash of the domain label string casted to bytes32,
     * checks existence of the domain in the registry and reverts if it exists.
     * Calls `ZNSTreasury` to do the staking part, gets `tokenId` for the new token to be minted
     * as domain hash casted to uint256, mints the token and sets the domain data in the `ZNSRegistry`
     * and, possibly, `ZNSAddressResolver`. Emits a `DomainRegistered` event.
     * @param name Name (label) of the domain to register
     * @param domainAddress (optional) Address for the `ZNSAddressResolver` to return when requested
     */
    function registerDomain(
        // TODO sub: change "name" to "label" everywhere in this and other contracts ??
        string calldata name,
        address domainAddress,
        DistributionConfig calldata distributionConfig
    ) external override returns (bytes32) {
        require(
            bytes(name).length != 0,
            "ZNSRegistrar: Domain Name not provided"
        );

        // Create hash for given domain name
        bytes32 domainHash = keccak256(bytes(name));

        require(
            !registry.exists(domainHash),
            "ZNSRegistrar: Domain already exists"
        );

        // Staking logic
        treasury.stakeForDomain(domainHash, name, msg.sender);

        _coreRegister(
            bytes32(0),
            domainHash,
            name,
            msg.sender,
            domainAddress
        );

        if (address(distributionConfig.pricingContract) != address(0)
            && address(distributionConfig.paymentContract) != address(0)) {
            // TODO sub: this adds 52k gas !
            subdomainRegistrar.setDistributionConfigForDomain(domainHash, distributionConfig);
        }
        // TODO sub: add setting the distribution config in the best way possible !
        //  calling back the subRegistrar might not be the best idea

        return domainHash;
    }

    function coreRegister(
        bytes32 parentHash,
        bytes32 domainHash,
        string memory name,
        address owner,
        address domainAddress
    ) external override onlyRegistrar {
        _coreRegister(
            parentHash,
            domainHash,
            name,
            owner,
            domainAddress
        );
    }

    function _coreRegister(
        // 0x0 when registering a root domain
        bytes32 parentHash,
        bytes32 domainHash,
        string memory name,
        address owner,
        address domainAddress
    ) internal {
        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);
        // mint token
        domainToken.register(owner, tokenId);

        // set data on Registry (for all) + Resolver (optional)
        // If no domain address is given, only the domain owner is set, otherwise
        // `ZNSAddressResolver` is called to assign an address to the newly registered domain.
        // If the `domainAddress` is not provided upon registration, a user can call `ZNSAddressResolver.setAddress`
        // to set the address themselves.
        if (domainAddress != address(0)) {
            registry.createDomainRecord(domainHash, owner, address(addressResolver));
            addressResolver.setAddress(domainHash, domainAddress);
        } else {
            registry.createDomainRecord(domainHash, owner, address(0));
        }

        emit DomainRegistered(
            parentHash,
            domainHash,
            tokenId,
            name,
            owner,
            domainAddress
        );
    }

    /**
     * @notice This function is the main entry point for the Revoke flow.
     * Revokes a domain such as `0://wilder`.
     * Gets `tokenId` from casted domain hash to uint256, calls `ZNSDomainToken` to burn the token,
     * deletes the domain data from the `ZNSRegistry` and calls `ZNSTreasury` to unstake and withdraw funds
     * user staked for the domain. Emits a `DomainRevoked` event.
     * @dev > Note that we are not clearing the data in `ZNSAddressResolver` as it is considered not necessary
     * since none other contracts will have the domain data on them.
     * If we are not clearing `ZNSAddressResolver` state slots, we are making the next Register transaction
     * for the same name cheaper, since SSTORE on a non-zero slot costs 5k gas,
     * while SSTORE on a zero slot costs 20k gas.
     * If a user wants to clear his data from `ZNSAddressResolver`, he can call `ZNSAddressResolver` directly himself
     * BEFORE he calls to revoke, otherwise, `ZNSRegistry` owner check will fail, since the owner there
     * will be 0x0 address.
     * Also note that in order to Revoke, a caller has to be the owner of both:
     * Name (in `ZNSRegistry`) and Token (in `ZNSDomainToken`).
     * @param domainHash Hash of the domain to revoke
     */
    function revokeDomain(bytes32 domainHash)
    external
    override
    {
        require(
            isOwnerOf(domainHash, msg.sender, OwnerOf.BOTH),
            "ZNSRegistrar: Not the owner of both Name and Token"
        );

        _coreRevoke(domainHash);

        treasury.unstakeForDomain(domainHash, msg.sender);
    }

    function coreRevoke(bytes32 domainHash) external override onlyRegistrar {
        _coreRevoke(domainHash);
    }

    function _coreRevoke(bytes32 domainHash) internal {
        uint256 tokenId = uint256(domainHash);
        domainToken.revoke(tokenId);
        registry.deleteRecord(domainHash);

        emit DomainRevoked(domainHash, msg.sender);
    }

    /**
     * @notice This function is the main entry point for the Reclaim flow. This flow is used to
     * reclaim full ownership of a domain (through becoming the owner of the Name) from the ownership of the Token.
     * This is used for different types of ownership transfers, such as:
     * - domain sale - a user will sell the Token, then the new owner has to call this function to reclaim the Name
     * - domain transfer - a user will transfer the Token, then the new owner
     * has to call this function to reclaim the Name
     *
     * A user needs to only be the owner of the Token to be able to Reclaim.
     * Updates the domain owner in the `ZNSRegistry` to the owner of the token and emits a `DomainReclaimed` event.
     */
    // TODO: should this function be on the DomainToken ??
    //  what are the benefits of having it there + adding Registry as a state var just for this call ??
    function reclaimDomain(bytes32 domainHash)
    external
    override
    {
        require(
            isOwnerOf(domainHash, msg.sender, OwnerOf.TOKEN),
            "ZNSRegistrar: Not the owner of the Token"
        );
        registry.updateDomainOwner(domainHash, msg.sender);

        emit DomainReclaimed(domainHash, msg.sender);
    }

    function isOwnerOf(bytes32 domainHash, address candidate, OwnerOf ownerOf) public view override returns (bool) {
        if (ownerOf == OwnerOf.NAME) {
            return candidate == registry.getDomainOwner(domainHash);
        } else if (ownerOf == OwnerOf.TOKEN) {
            return candidate == domainToken.ownerOf(uint256(domainHash));
        } else if (ownerOf == OwnerOf.BOTH) {
            return candidate == registry.getDomainOwner(domainHash)
                && candidate == domainToken.ownerOf(uint256(domainHash));
        }

        revert("Wrong enum value for `ownerOf`");
    }

    /**
     * @notice Setter function for the `ZNSRegistry` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param registry_ Address of the `ZNSRegistry` contract
     */
    function setRegistry(address registry_) public override(ARegistryWired, IZNSRegistrar) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Setter function for the `ZNSTreasury` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param treasury_ Address of the `ZNSTreasury` contract
     */
    function setTreasury(address treasury_) public override onlyAdmin {
        require(
            treasury_ != address(0),
            "ZNSRegistrar: treasury_ is 0x0 address"
        );
        treasury = IZNSTreasury(treasury_);

        emit TreasurySet(treasury_);
    }

    /**
     * @notice Setter function for the `ZNSDomainToken` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param domainToken_ Address of the `ZNSDomainToken` contract
     */
    function setDomainToken(address domainToken_) public override onlyAdmin {
        require(
            domainToken_ != address(0),
            "ZNSRegistrar: domainToken_ is 0x0 address"
        );
        domainToken = IZNSDomainToken(domainToken_);

        emit DomainTokenSet(domainToken_);
    }

    function setSubdomainRegistrar(address subdomainRegistrar_) external override onlyAdmin {
        require(subdomainRegistrar_ != address(0), "ZNSRegistrar: subdomainRegistrar_ is 0x0 address");

        subdomainRegistrar = IZNSSubdomainRegistrar(subdomainRegistrar_);
        emit SubdomainRegistrarSet(subdomainRegistrar_);
    }

    /**
     * @notice Setter function for the `ZNSAddressResolver` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param addressResolver_ Address of the `ZNSAddressResolver` contract
     */
    function setAddressResolver(address addressResolver_) public override onlyAdmin {
        require(
            addressResolver_ != address(0),
            "ZNSRegistrar: addressResolver_ is 0x0 address"
        );
        addressResolver = IZNSAddressResolver(addressResolver_);

        emit AddressResolverSet(addressResolver_);
    }

    /**
     * @notice Setter function for the `ZNSAccessController` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param accessController_ Address of the `ZNSAccessController` contract
     */
    function setAccessController(address accessController_)
    external
    override(AAccessControlled, IZNSRegistrar)
    onlyAdmin {
        _setAccessController(accessController_);
    }

    /**
     * @notice Getter function for the `ZNSAccessController` address in state.
     */
    function getAccessController() external view override(AAccessControlled, IZNSRegistrar) returns (address) {
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
