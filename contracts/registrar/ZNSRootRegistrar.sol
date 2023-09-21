// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSRootRegistrar, CoreRegisterArgs } from "./IZNSRootRegistrar.sol";
import { IZNSTreasury } from "../treasury/IZNSTreasury.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSAddressResolver } from "../resolver/IZNSAddressResolver.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { IZNSCurvePricer } from "../price/IZNSCurvePricer.sol";


/**
 * @title Main entry point for the three main flows of ZNS - Register, Reclaim and Revoke a domain.
 * @notice This contract serves as the "umbrella" for many ZNS operations, it is given REGISTRAR_ROLE
 * to combine multiple calls/operations between different modules to achieve atomic state changes
 * and proper logic for the ZNS flows. You can see functions in other modules that are only allowed
 * to be called by this contract to ensure proper management of ZNS data in multiple places.
 * RRR - Register, Reclaim, Revoke start here and then call other modules to complete the flow.
 * ZNSRootRegistrar.sol stores most of the other contract addresses and can communicate with other modules,
 * but the relationship is one-sided, where other modules do not need to know about the ZNSRootRegistrar.sol,
 * they only check REGISTRAR_ROLE that can, in theory, be assigned to any other address.
 */
contract ZNSRootRegistrar is
    UUPSUpgradeable,
    AAccessControlled,
    ARegistryWired,
    IZNSRootRegistrar {

    // TODO sub data: can (and should) we make a new primitive
    //  interface that inherits IZNSPricer and adds getProtocolFee()
    //  so that we don't have to upgrade this contract every time we
    //  want to switch a pricing contract for Zero?
    IZNSCurvePricer public curvePricer;
    IZNSTreasury public treasury;
    IZNSDomainToken public domainToken;
    IZNSAddressResolver public addressResolver;
    IZNSSubRegistrar public subRegistrar;

    /**
     * @notice Create an instance of the ZNSRootRegistrar.sol
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
        address curvePricer_,
        address treasury_,
        address domainToken_,
        address addressResolver_
    ) external override initializer {
        _setAccessController(accessController_);
        setRegistry(registry_);
        setCurvePricer(curvePricer_);
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
    function registerRootDomain(
        // TODO sub: change "name" to "label" everywhere in this and other contracts ??
        string calldata name,
        address domainAddress,
        string calldata tokenURI,
        DistributionConfig calldata distributionConfig
    ) external override returns (bytes32) {
        require(
            bytes(name).length != 0,
            "ZNSRootRegistrar: Domain Name not provided"
        );

        // Create hash for given domain name
        bytes32 domainHash = keccak256(bytes(name));

        require(
            !registry.exists(domainHash),
            "ZNSRootRegistrar: Domain already exists"
        );

        // Get price for the domain
        uint256 domainPrice = curvePricer.getPrice(0x0, name);

        _coreRegister(
            CoreRegisterArgs(
                bytes32(0),
                domainHash,
                name,
                msg.sender,
                domainPrice,
                0,
                domainAddress,
                tokenURI,
                true
            )
        );

        if (address(distributionConfig.pricerContract) != address(0)) {
            // this adds roughly 100k gas to the register tx
            subRegistrar.setDistributionConfigForDomain(domainHash, distributionConfig);
        }

        return domainHash;
    }

    function coreRegister(
        CoreRegisterArgs memory args
    ) external override onlyRegistrar {
        _coreRegister(
            args
        );
    }

    function _coreRegister(
        CoreRegisterArgs memory args
    ) internal {
        // TODO sub: figure out if this is needed !!!
        require(
            _isValidString(args.label),
            "ZNSRootRegistrar: Invalid domain name"
        );

        // payment part of the logic
        if (args.price > 0) {
            _processPayment(args);
        }

        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(args.domainHash);
        // mint token
        domainToken.register(args.registrant, tokenId, args.tokenURI);

        // set data on Registry (for all) + Resolver (optional)
        // If no domain address is given, only the domain owner is set, otherwise
        // `ZNSAddressResolver` is called to assign an address to the newly registered domain.
        // If the `domainAddress` is not provided upon registration, a user can call `ZNSAddressResolver.setAddress`
        // to set the address themselves.
        if (args.domainAddress != address(0)) {
            registry.createDomainRecord(args.domainHash, args.registrant, address(addressResolver));
            addressResolver.setAddress(args.domainHash, args.domainAddress);
        } else {
            registry.createDomainRecord(args.domainHash, args.registrant, address(0));
        }

        emit DomainRegistered(
            args.parentHash,
            args.domainHash,
            tokenId,
            args.label,
            args.registrant,
            args.domainAddress
        );
    }

    function _processPayment(CoreRegisterArgs memory args) internal {
        // args.stakeFee can be 0
        uint256 protocolFee = curvePricer.getProtocolFee(args.price + args.stakeFee);

        if (args.isStakePayment) { // for all root domains or subdomains with stake payment
            treasury.stakeForDomain(
                args.parentHash,
                args.domainHash,
                args.registrant,
                args.price,
                args.stakeFee,
                protocolFee
            );
        } else { // direct payment for subdomains
            treasury.processDirectPayment(
                args.parentHash,
                args.domainHash,
                args.registrant,
                args.price,
                protocolFee
            );
        }
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
            "ZNSRootRegistrar: Not the owner of both Name and Token"
        );

        subRegistrar.setAccessTypeForDomain(domainHash, AccessType.LOCKED);
        _coreRevoke(domainHash, msg.sender);
    }

    function coreRevoke(bytes32 domainHash, address owner) external override onlyRegistrar {
        _coreRevoke(domainHash, owner);
    }

    function _coreRevoke(bytes32 domainHash, address owner) internal {
        uint256 tokenId = uint256(domainHash);
        domainToken.revoke(tokenId);
        registry.deleteRecord(domainHash);

        // check if user registered a domain with the stake
        (, uint256 stakedAmount) = treasury.stakedForDomain(domainHash);
        bool stakeRefunded = false;
        // send the stake back if it exists
        if (stakedAmount > 0) {
            treasury.unstakeForDomain(domainHash, owner);
            stakeRefunded = true;
        }

        emit DomainRevoked(domainHash, owner, stakeRefunded);
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
            "ZNSRootRegistrar: Not the owner of the Token"
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
    function setRegistry(address registry_) public override(ARegistryWired, IZNSRootRegistrar) onlyAdmin {
        _setRegistry(registry_);
    }

    function setCurvePricer(address curvePricer_) public override onlyAdmin {
        require(
            curvePricer_ != address(0),
            "ZNSRootRegistrar: curvePricer_ is 0x0 address"
        );
        curvePricer = IZNSCurvePricer(curvePricer_);

        emit CurvePricerSet(curvePricer_);
    }

    /**
     * @notice Setter function for the `ZNSTreasury` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param treasury_ Address of the `ZNSTreasury` contract
     */
    function setTreasury(address treasury_) public override onlyAdmin {
        require(
            treasury_ != address(0),
            "ZNSRootRegistrar: treasury_ is 0x0 address"
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
            "ZNSRootRegistrar: domainToken_ is 0x0 address"
        );
        domainToken = IZNSDomainToken(domainToken_);

        emit DomainTokenSet(domainToken_);
    }

    function setSubRegistrar(address subRegistrar_) external override onlyAdmin {
        require(subRegistrar_ != address(0), "ZNSRootRegistrar: subRegistrar_ is 0x0 address");

        subRegistrar = IZNSSubRegistrar(subRegistrar_);
        emit SubRegistrarSet(subRegistrar_);
    }

    /**
     * @notice Setter function for the `ZNSAddressResolver` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * @param addressResolver_ Address of the `ZNSAddressResolver` contract
     */
    function setAddressResolver(address addressResolver_) public override onlyAdmin {
        require(
            addressResolver_ != address(0),
            "ZNSRootRegistrar: addressResolver_ is 0x0 address"
        );
        addressResolver = IZNSAddressResolver(addressResolver_);

        emit AddressResolverSet(addressResolver_);
    }

    // TODO audit: Do we need to check this on the contract?! This costs extra gas and only checks
    //  a couple of specific cases. Technically, someone is still able to directly register
    //  an incorrect name. Getting to this hash from any other layer should be problematic,
    //  so even if they did register the name on the contract, they should not be able to actually
    //  use it since they can't arrive at their own hash (or can they?).
    //  How much of a problem would it be if we don't check this?
    //  Should we keep this, does it make sense to keep this, should we add more validations ???!
    function _isValidString(string memory str) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bool isValid = strBytes.length != 0;
        isValid = isValid && (strBytes[0] != 0x20); // first char is not 0x20

        return isValid;
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
