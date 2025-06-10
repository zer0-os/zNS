// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { IZNSRootRegistrar, CoreRegisterArgs } from "./IZNSRootRegistrar.sol";
import { IZNSTreasury } from "../treasury/IZNSTreasury.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSAddressResolver } from "../resolver/IZNSAddressResolver.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSPricer } from "../price/IZNSPricer.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import {
    ZeroAddressPassed,
    ZeroValuePassed,
    AddressIsNotAContract,
    DomainAlreadyExists,
    NotAuthorizedForDomain
} from "../utils/CommonErrors.sol";
import { ARegistrationPause } from "./ARegistrationPause.sol";


/**
 * @title Main entry point for the three main flows of ZNS - Register Root Domain, Assign Domain Token
 *  and Revoke any domain.
 *
 * @notice This contract serves as the "umbrella" for many ZNS operations, it is given `REGISTRAR_ROLE`
 * to combine multiple calls/operations between different modules to achieve atomic state changes
 * and proper logic for the ZNS flows. You can see functions in other modules that are only allowed
 * to be called by this contract to ensure proper management of ZNS data in multiple places.
 * Register, Assign Token and Revoke start here and then call other modules to complete the flow.
 * `ZNSRootRegistrar` stores most of the other contract addresses and can communicate with other modules,
 * but the relationship is one-sided, where other modules do not need to know about the `ZNSRootRegistrar`,
 * they only check `REGISTRAR_ROLE` that can, in theory, be assigned to any other address.
 *
 * @dev This contract is also called at the last stage of registering subdomains, since it has the common
 * logic required to be performed for any level domains.
 */
contract ZNSRootRegistrar is
    UUPSUpgradeable,
    AAccessControlled,
    ARegistryWired,
    ARegistrationPause,
    IZNSRootRegistrar {
    using StringUtils for string;

    /**
     * @notice Address of the `IZNSPricer` type contract that is used for root domains.
     */
    IZNSPricer public override rootPricer;
    /**
     * @notice The price config for the root domains, encoded as bytes.
     * This is used by the `IZNSPricer` to determine the price for root domains.
     */
    bytes public override rootPriceConfig;
    /**
     * @notice The `ZNSTreasury` contract that is used to handle payments and staking for domains.
     */
    IZNSTreasury public override treasury;
    /**
     * @notice The `ZNSDomainToken` contract that is used to mint and manage domain tokens.
     * This contract is used to issue a token for each registered domain.
     */
    IZNSDomainToken public override domainToken;
    /**
     * @notice The `ZNSSubRegistrar` contract that is used to handle subdomain registrations.
     * This contract is used to set distribution configs and manage subdomain registrations.
     */
    IZNSSubRegistrar public override subRegistrar;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Create an instance of the `ZNSRootRegistrar`
     * for registering and revoking ZNS domains
     *
     * @dev Instead of direct assignments, we are calling the setter functions
     * to apply Access Control and ensure only the ADMIN can set the addresses.
     *
     * @param accessController_ Address of the ZNSAccessController contract
     * @param registry_ Address of the ZNSRegistry contract
     * @param rootPricer_ Address of the IZNSPricer type contract that Zero chose to use for the root domains
     * @param priceConfig_  IZNSPricer pricer config data encoded as bytes for root domains
     * @param treasury_ Address of the ZNSTreasury contract
     * @param domainToken_ Address of the ZNSDomainToken contract
     */
    function initialize(
        address accessController_,
        address registry_,
        address rootPricer_,
        bytes calldata priceConfig_,
        address treasury_,
        address domainToken_
    ) external override initializer {
        _setAccessController(accessController_);
        setRegistry(registry_);

        setRootPricerAndConfig(rootPricer_, priceConfig_);
        setTreasury(treasury_);
        setDomainToken(domainToken_);
    }

    /**
     * @notice This function is the main entry point for the Register Root Domain flow.
     * Registers a new root domain such as `0://zero`.
     * Gets domain hash as a keccak256 hash of the domain label string casted to bytes32,
     * checks existence of the domain in the registry and reverts if it exists.
     * Calls `ZNSTreasury` to do the payment, gets `tokenId` for the new token to be minted
     * as domain hash casted to uint256, mints the token and sets the domain data in the `ZNSRegistry`
     * and, possibly, `ZNSAddressResolver`. Emits a `DomainRegistered` event.
     *
     * @param args A struct of domain registration data:
     *       + name Name (label) of the domain to register
     *       + domainAddress (optional) Address for the `ZNSAddressResolver` to return when requested
     *       + tokenOwner (optional) Address to assign the domain token to (to offer domain usage without ownership)
     *       + tokenURI URI to assign to the Domain Token issued for the domain
     *       + distributionConfig (optional) Distribution config for the domain to set in the same tx
     *     > Please note that passing distribution config will add more gas to the tx and most importantly -
     *      - the `distributionConfig` HAS to be passed FULLY filled or all zeros. It is optional as a whole,
     *      but all the parameters inside are required.
     *       + paymentConfig (optional) Payment config for the domain to set on ZNSTreasury in the same tx
     *      > `paymentConfig` has to be fully filled or all zeros. It is optional as a whole,
     *      but all the parameters inside are required.
     */
    function registerRootDomain(
        RootDomainRegistrationArgs calldata args
    ) public override whenRegNotPaused(accessController) returns (bytes32) {
        // Create hash for given domain name
        bytes32 domainHash = keccak256(bytes(args.name));

        // Get price for the domain
        uint256 domainPrice = rootPricer.getPrice(rootPriceConfig, args.name, true);
        _coreRegister(
            CoreRegisterArgs({
                parentHash: bytes32(0),
                domainHash: domainHash,
                domainOwner: msg.sender,
                tokenOwner: args.tokenOwner == address(0) ? msg.sender : args.tokenOwner,
                domainAddress: args.domainAddress,
                price: domainPrice,
                stakeFee: 0,
                label: args.name,
                tokenURI: args.tokenURI,
                isStakePayment: true,
                paymentConfig: args.paymentConfig
            })
        );

        if (address(args.distrConfig.pricerContract) != address(0)) {
            // this adds additional gas to the register tx if passed
            subRegistrar.setDistributionConfigForDomain(domainHash, args.distrConfig);
        }

        return domainHash;
    }

    /**
     * @notice This function allows registering multiple root domains in a single transaction.
     * It iterates through an array of `SubdomainRegistrationArgs` structs, registering each domain
     * by calling the `registerRootDomain` function for each entry.
     *
     * @dev This function reduces the number of transactions required to register multiple domains,
     * saving gas and improving efficiency. Each domain registration is processed sequentially,
     * so order of arguments matters.
     *
     * @param args An array of `SubdomainRegistrationArgs` structs, each containing:
     *      + `name`: The name (label) of the domain to register.
     *      + `domainAddress`: The address to associate with the domain in the resolver (optional).
     *      + `tokenOwner`: The address to assign the domain token to (optional, defaults to msg.sender).
     *      + `tokenURI`: The URI to assign to the domain token.
     *      + `distrConfig`: The distribution configuration for the domain (optional).
     *      + `paymentConfig`: The payment configuration for the domain (optional).
     * @return domainHashes An array of `bytes32` hashes representing registered domains.
     */
    function registerRootDomainBulk(
        RootDomainRegistrationArgs[] calldata args
    ) external override whenRegNotPaused(accessController) returns (bytes32[] memory) {
        bytes32[] memory domainHashes = new bytes32[](args.length);

        for (uint256 i = 0; i < args.length;) {
            domainHashes[i] = registerRootDomain(args[i]);

            unchecked {
                ++i;
            }
        }

        return domainHashes;
    }

    /**
     * @notice External function used by all Registrars for the final stage of registering subdomains.
     *
     * @param args `CoreRegisterArgs`: Struct containing all the arguments required to register a domain
     *  with ZNSRootRegistrar.coreRegister():
     *      + `parentHash`: The hash of the parent domain (0x0 for root domains)
     *      + `domainHash`: The hash of the domain to be registered
     *      + `isStakePayment`: A flag for whether the payment is a stake payment or not
     *      + `domainOwner`: The address that will be set as owner in Registry record
     *      + `tokenOwner`: The address that will be set as owner in DomainToken contract
     *      + `domainAddress`: The address to which the domain will be resolved to
     *      + `price`: The determined price for the domain to be registered based on parent rules
     *      + `stakeFee`: The determined stake fee for the domain to be registered (only for PaymentType.STAKE!)
     *      + `paymentConfig`: The payment config for the domain to be registered
     *      + `label`: The label of the domain to be registered
     *      + `tokenURI`: The tokenURI for the domain to be registered
     */
    function coreRegister(
        CoreRegisterArgs memory args
    ) external override onlyRegistrar {
        _coreRegister(
            args
        );
    }

    /**
     * @dev Internal function that is called by this contract to finalize the canonical registration of a domain.
     * This function as also called by the external `coreRegister()` function as a part of
     * registration of subdomains.
     * This function validates the domain label, checks domain existence, kicks off payment processing logic,
     * mints the token, sets the domain data in the `ZNSRegistry` and fires a `DomainRegistered` event.
     * For params see external `coreRegister()` docs.
    */
    function _coreRegister(
        CoreRegisterArgs memory args
    ) internal {
        // Confirms string values are only [a-z0-9-]
        args.label.validate();

        if (registry.exists(args.domainHash))
            revert DomainAlreadyExists(args.domainHash);

        // payment part of the logic
        if (args.price > 0) {
            _processPayment(args);
        }

        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(args.domainHash);
        // mint token
        domainToken.register(args.tokenOwner, tokenId, args.tokenURI);

        // set data on Registry (for all) + Resolver (optional)
        // If no domain address is given, only the domain owner is set, otherwise
        // `ZNSAddressResolver` is called to assign an address to the newly registered domain.
        // If the `domainAddress` is not provided upon registration, a user can call `ZNSAddressResolver.setAddress`
        // to set the address themselves.
        if (args.domainAddress != address(0)) {
            registry.createDomainRecord(args.domainHash, args.domainOwner, "address");

            IZNSAddressResolver(registry.getDomainResolver(args.domainHash))
                .setAddress(args.domainHash, args.domainAddress);

        } else {
            // By passing an empty string we tell the registry to not add a resolver
            registry.createDomainRecord(args.domainHash, args.domainOwner, "");
        }

        // Because we check in the web app for the existence of both values in a payment config,
        // it's fine to just check for one here
        if (args.paymentConfig.beneficiary != address(0)) {
            treasury.setPaymentConfig(args.domainHash, args.paymentConfig);
        }

        emit DomainRegistered(
            args.parentHash,
            args.domainHash,
            args.label,
            tokenId,
            args.tokenURI,
            args.domainOwner,
            args.tokenOwner,
            args.domainAddress
        );
    }

    /**
     * @dev Internal function that is called by this contract to finalize the payment for a domain.
     * Once the specific case is determined and `protocolFee` calculated, it calls `ZNSTreasury` to perform transfers.
    */
    function _processPayment(CoreRegisterArgs memory args) internal {
        // args.stakeFee can be 0
        uint256 protocolFee = rootPricer.getFeeForPrice(rootPriceConfig, args.price + args.stakeFee);

        if (args.isStakePayment) {
            treasury.stakeForDomain(
                args.parentHash,
                args.domainHash,
                args.domainOwner,
                args.price,
                args.stakeFee,
                protocolFee
            );
        } else {
            treasury.processDirectPayment(
                args.parentHash,
                args.domainHash,
                args.domainOwner,
                args.price,
                protocolFee
            );
        }
    }

    /**
     * @notice This function is the main entry point for the Revoke flow.
     * Revokes a domain such as `0://zero`.
     * Gets `tokenId` from casted domain hash to uint256, calls `ZNSDomainToken` to burn the token,
     * deletes the domain data from the `ZNSRegistry` and calls `ZNSTreasury` to unstake and withdraw funds
     * if user staked for the domain. Emits a `DomainRevoked` event.
     *
     * @dev > Note that we are not clearing the data in `ZNSAddressResolver` as it is considered not necessary
     * since none other contracts will have the domain data on them.
     * If we are not clearing `ZNSAddressResolver` state slots, we are making the next Register transaction
     * for the same name cheaper, since SSTORE on a non-zero slot is cheaper.
     * If a user wants to clear his data from `ZNSAddressResolver`, he can call `ZNSAddressResolver` directly himself
     * BEFORE he calls to revoke, otherwise, `ZNSRegistry` owner check will fail, since the owner there
     * will be 0x0 address.
     * > Note that in order to Revoke, a caller has to be the owner of the hash in the `ZNSRegistry`.
     * And that owner can revoke and burn the token even if he is NOT the owner of the token!
     * Ownership of the hash in Registry always overrides ownership of the token!
     *
     * @param domainHash Hash of the domain to revoke
     */
    function revokeDomain(bytes32 domainHash)
    external
    override
    {
        if (msg.sender != registry.getDomainOwner(domainHash))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        subRegistrar.clearMintlistAndLock(domainHash);
        _coreRevoke(domainHash, msg.sender);
    }

    /**
     * @dev Internal part of the `revokeDomain()`. Called by this contract to finalize the Revoke flow of all domains.
     * It calls `ZNSDomainToken` to burn the token, deletes the domain data from the `ZNSRegistry` and
     * calls `ZNSTreasury` to unstake and withdraw funds user if staked for the domain. Also emits
     * a `DomainRevoked` event. A protocol fee will be taken on revoke if the user staked for the domain.
    */
    function _coreRevoke(bytes32 domainHash, address owner) internal {
        domainToken.revoke(uint256(domainHash));
        registry.deleteRecord(domainHash);

        // check if user registered a domain with the stake
        (, uint256 stakedAmount) = treasury.stakedForDomain(domainHash);
        bool stakeRefunded = false;
        // send the stake back if it exists
        if (stakedAmount > 0) {
            uint256 protocolFee = rootPricer.getFeeForPrice(rootPriceConfig, stakedAmount);

            treasury.unstakeForDomain(domainHash, owner, protocolFee);
            stakeRefunded = true;
        }

        emit DomainRevoked(domainHash, owner, stakeRefunded);
    }

    /**
     * @notice This function lets domain owner in Registry to transfer the token separately from any address
     * to any other address (except the zero address), since the Registry owner always overrides the token owner.
     *
     * @dev This is the ONLY way to transfer the token separately from the domain hash
     * and only Registry owner can do this! This can also be used to send the token to yourself as Registry owner
     * if you moved it or minted it initially to somebody else to use your domain.
     * Transferring the token away from yourself with this function makes the domain "controlled" in a sense
     * that token owner could use the domain, but not revoke it, transfer it to another address or access
     * domain management functions across the system.
     *
     * Updates the token owner in the `ZNSDomainToken` to the "to" address and emits a `DomainTokenReassigned` event.
     */
    function assignDomainToken(bytes32 domainHash, address to)
    external
    override
    {
        if (msg.sender != registry.getDomainOwner(domainHash))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        address curTokenOwner = domainToken.ownerOf(uint256(domainHash));
        if (curTokenOwner == to)
            revert AlreadyTokenOwner(domainHash, curTokenOwner);

        domainToken.transferOverride(
            to,
            uint256(domainHash)
        );

        emit DomainTokenReassigned(domainHash, to);
    }

    /**
     * @notice Setter function for the `ZNSRegistry` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     *
     * @param registry_ Address of the `ZNSRegistry` contract
     */
    function setRegistry(address registry_) public override(ARegistryWired, IZNSRootRegistrar) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Setter for the IZNSPricer type contract that Zero chooses to handle Root Domains.
     * Only ADMIN in `ZNSAccessController` can call this function.
     *
     * @param pricer_ Address of the IZNSPricer type contract to set as pricer of Root Domains
     * @param priceConfig_ The price config, encoded as bytes, for the given IZNSPricer contract
    */
    function setRootPricerAndConfig(
        address pricer_,
        bytes memory priceConfig_
    ) public override onlyAdmin {
        if (pricer_ == address(0))
            revert ZeroAddressPassed();

        if (pricer_.code.length == 0) revert AddressIsNotAContract();

        _setRootPriceConfig(IZNSPricer(pricer_), priceConfig_);
        rootPricer = IZNSPricer(pricer_);

        emit RootPricerSet(pricer_, priceConfig_);
    }

    /**
     * @notice Set the price configuration for root domains
     *
     * @param priceConfig_ The price configuration for root domains, encoded as bytes,
     *  has to match the required data type for the currently set `rootPricer` contract in state!
     */
    function setRootPriceConfig(bytes memory priceConfig_) public override onlyAdmin {
        _setRootPriceConfig(rootPricer, priceConfig_);
    }

    /**
     * @notice Setter function for the `ZNSTreasury` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     *
     * @param treasury_ Address of the `ZNSTreasury` contract
     */
    function setTreasury(address treasury_) public override onlyAdmin {
        if (treasury_ == address(0))
            revert ZeroAddressPassed();

        treasury = IZNSTreasury(treasury_);

        emit TreasurySet(treasury_);
    }

    /**
     * @notice Setter function for the `ZNSDomainToken` address in state.
     * Only ADMIN in `ZNSAccessController` can call this function.
     *
     * @param domainToken_ Address of the `ZNSDomainToken` contract
     */
    function setDomainToken(address domainToken_) public override onlyAdmin {
        if (domainToken_ == address(0))
            revert ZeroAddressPassed();

        domainToken = IZNSDomainToken(domainToken_);

        emit DomainTokenSet(domainToken_);
    }

    /**
     * @notice Setter for `ZNSSubRegistrar` contract in state. Only ADMIN can call this function.
     *
     * @param subRegistrar_ Address of the `ZNSSubRegistrar` contract
    */
    function setSubRegistrar(address subRegistrar_) external override onlyAdmin {
        if (subRegistrar_ == address(0))
            revert ZeroAddressPassed();

        subRegistrar = IZNSSubRegistrar(subRegistrar_);
        emit SubRegistrarSet(subRegistrar_);
    }

    /**
     * @notice Pauses the registration of new domains.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * Fires `RegistrationPauseSet` event.
     *
     * @dev When registration is paused, only ADMINs can register new domains.
     */
    function pauseRegistration() external override onlyAdmin {
        _setRegistrationPause(true);
    }

    /**
     * @notice Unpauses the registration of new domains.
     * Only ADMIN in `ZNSAccessController` can call this function.
     * Fires `RegistrationPauseSet` event.
     */
    function unpauseRegistration() external override onlyAdmin {
        _setRegistrationPause(false);
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     *
     * @param newImplementation The implementation contract to upgrade to
     */
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }

    /**
     * @dev Internal function to set and validate the root price config.
     * Validates the price config with the current `rootPricer` and sets it in state.
     * Emits a `RootPriceConfigSet` event.
     *
     * @param pricer_ The IZNSPricer contract to validate the price config against
     * @param priceConfig_ The price config to set, encoded as bytes
     */
    function _setRootPriceConfig(IZNSPricer pricer_, bytes memory priceConfig_) internal {
        if (priceConfig_.length == 0) revert ZeroValuePassed();

        pricer_.validatePriceConfig(priceConfig_);

        rootPriceConfig = priceConfig_;

        emit RootPriceConfigSet(priceConfig_);
    }
}
