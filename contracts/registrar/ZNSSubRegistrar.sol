// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IZNSRootRegistrar, CoreRegisterArgs } from "./IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "./IZNSSubRegistrar.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { DomainAlreadyExists, ZeroAddressPassed, NotAuthorizedForDomain } from "../utils/CommonErrors.sol";

import { console } from "hardhat/console.sol";
/**
 * @title ZNSSubRegistrar.sol - The contract for registering and revoking subdomains of zNS.
 * @dev This contract has the entry point for registering subdomains, but calls
 * the ZNSRootRegistrar back to finalize registration. Common logic for domains
 * of any level is in the `ZNSRootRegistrar.coreRegister()`.
*/
contract ZNSSubRegistrar is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSSubRegistrar {
    using StringUtils for string;

    /**
     * @notice State var for the ZNSRootRegistrar contract that finalizes registration of subdomains.
    */
    IZNSRootRegistrar public rootRegistrar;

    /**
     * @notice Mapping of domainHash to distribution config set by the domain owner/operator.
     * These configs are used to determine how subdomains are distributed for every parent.
     * @dev Note that the rules outlined in the DistributionConfig are only applied to direct children!
    */
    mapping(bytes32 domainHash => DistributionConfig config) public override distrConfigs;

    struct Mintlist {
        mapping(uint256 idx => mapping(address candidate => bool allowed)) list;
        uint256 ownerIndex;
    }

    /**
     * @notice Mapping of domainHash to mintlist set by the domain owner/operator.
     * These configs are used to determine who can register subdomains for every parent
     * in the case where parent's DistributionConfig.AccessType is set to AccessType.MINTLIST.
    */
    mapping(bytes32 domainHash => Mintlist mintStruct) public mintlist;

    modifier onlyOwnerOperatorOrRegistrar(bytes32 domainHash) {
        if (
            !registry.isOwnerOrOperator(domainHash, msg.sender)
            && !accessController.isRegistrar(msg.sender)
        ) revert NotAuthorizedForDomain(msg.sender, domainHash);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _accessController,
        address _registry,
        address _rootRegistrar
    ) external override initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
        setRootRegistrar(_rootRegistrar);
    }

    function registerSubdomainBulk(
        BulkMigrationArgs calldata args,
        DistributionConfig calldata emptyDistrConfig,
        PaymentConfig calldata emptyPaymentConfig
    ) public onlyAdmin {
        // For the migration specifically so we setup with empty configs
        for (uint256 i = 0; i < args.parentHashes.length;) {
            bytes32 domainHash = registerSubdomain(
                args.parentHashes[i],
                args.labels[i],
                args.domainAddresses[i],
                args.tokenURIs[i],
                emptyDistrConfig,
                emptyPaymentConfig
            );

            // transfer domain token
            IZNSDomainToken(args.domainToken).transferFrom(
                msg.sender,
                args.owners[i],
                uint256(domainHash)
            );

            // update registry domain record
            registry.updateDomainOwnerForMigration(
                domainHash,
                args.owners[i]
            );

            unchecked {
                ++i;
            }
        }
    }


    error ParentNotExist(bytes32 parentHash);
    error CallerNotOwner(address caller);

    /**
     * @notice Entry point to register a subdomain under a parent domain specified.
     * @dev Reads the `DistributionConfig` for the parent domain to determine how to distribute,
     * checks if the sender is allowed to register, check if subdomain is available,
     * acquires the price and other data needed to finalize the registration
     * and calls the `ZNSRootRegistrar.coreRegister()` to finalize.
     * @param parentHash The hash of the parent domain to register the subdomain under
     * @param label The label of the subdomain to register (e.g. in 0://zero.child the label would be "child").
     * @param domainAddress (optional) The address to which the subdomain will be resolved to
     * @param tokenURI (required) The tokenURI for the subdomain to be registered
     * @param distrConfig (optional) The distribution config to be set for the subdomain to set rules for children
     * @param paymentConfig (optional) Payment config for the domain to set on ZNSTreasury in the same tx
     *  > `paymentConfig` has to be fully filled or all zeros. It is optional as a whole,
     *  but all the parameters inside are required.
    */
    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        string calldata tokenURI,
        DistributionConfig calldata distrConfig,
        PaymentConfig calldata paymentConfig
    ) public override returns (bytes32) {
        // Confirms string values are only [a-z0-9-]
        label.validate();

        bytes32 domainHash = hashWithParent(parentHash, label);
        if (registry.exists(domainHash))
            revert DomainAlreadyExists(domainHash);

        DistributionConfig memory parentConfig = distrConfigs[parentHash];

        if (!registry.exists(parentHash))
            revert ParentNotExist(parentHash);

        // console.logBytes32(parentHash);


        // This returns 0, locked, but we dont register domains locked, why does this happen?
        if(uint256(parentConfig.accessType) == 0) {
            console.log("fail here");
            // Because we do
            console.logBytes32(parentHash);
            console.logBytes32(domainHash);
            console.log(registry.exists(parentHash));
        }

        bool isOwnerOrOperator = registry.isOwnerOrOperator(parentHash, msg.sender);

        if (parentConfig.accessType == AccessType.LOCKED)
            revert ParentLockedOrDoesntExist(parentHash);

        // if (!isOwnerOrOperator)
        //     revert CallerNotOwner(msg.sender);

        if (parentConfig.accessType == AccessType.MINTLIST) {
            if (
                !mintlist[parentHash]
                    .list
                    [mintlist[parentHash].ownerIndex]
                    [msg.sender]
            ) revert SenderNotApprovedForPurchase(parentHash, msg.sender);
        }

        CoreRegisterArgs memory coreRegisterArgs = CoreRegisterArgs({
            parentHash: parentHash,
            domainHash: domainHash,
            label: label,
            registrant: msg.sender,
            price: 0,
            stakeFee: 0,
            domainAddress: domainAddress,
            tokenURI: tokenURI,
            isStakePayment: parentConfig.paymentType == PaymentType.STAKE,
            paymentConfig: paymentConfig
        });

        // Because we transfer root ownership right after registration, the caller here is not the owner
        // causes errors
        // console.log("here");
        // if (!isOwnerOrOperator) { // TODO no payment considerations for migration
        //     // console.log("here too");
            
        //     if (coreRegisterArgs.isStakePayment) {
        //         (coreRegisterArgs.price, coreRegisterArgs.stakeFee) = IZNSPricer(address(parentConfig.pricerContract))
        //             .getPriceAndFee(
        //                 parentHash,
        //                 label,
        //                 true
        //             );
        //     } else {
        //         coreRegisterArgs.price = IZNSPricer(address(parentConfig.pricerContract))
        //             .getPrice(
        //                 parentHash,
        //                 label,
        //                 true
        //             );
        //     }
        // }

        rootRegistrar.coreRegister(coreRegisterArgs);

        // ! note that the config is set ONLY if ALL values in it are set, specifically,
        // without pricerContract being specified, the config will NOT be set
        // if (address(distrConfig.pricerContract) != address(0)) {
            setDistributionConfigForDomain(coreRegisterArgs.domainHash, distrConfig);
        // }

        return domainHash;
    }

    /**
     * @notice Helper function to hash a child label with a parent domain hash.
    */
    function hashWithParent(
        bytes32 parentHash,
        string calldata label
    ) public pure override returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                parentHash,
                keccak256(bytes(label))
            )
        );
    }

    /**
     * @notice Setter for `distrConfigs[domainHash]`.
     * Only domain owner/operator or ZNSRootRegistrar can call this function.
     * @dev This config can be changed by the domain owner/operator at any time or be set
     * after registration if the config was not provided during the registration.
     * Fires `DistributionConfigSet` event.
     * @param domainHash The domain hash to set the distribution config for
     * @param config The new distribution config to set (for config fields see `IDistributionConfig.sol`)
    */
    function setDistributionConfigForDomain(
        bytes32 domainHash,
        DistributionConfig calldata config
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        // TODO uncomment after migration
        // We allow this because we don't set a pricer but we want to register still

        // TODO should we just set the pricer properly for everyone?
        // Should we copy each persons configs if we can?
        // Same with issue around staking vs. direct pay
        // if migration happens then users unstake later they would expect to be refunded
        // if (address(config.pricerContract) == address(0))
        //     revert ZeroAddressPassed();

        distrConfigs[domainHash] = config;

        emit DistributionConfigSet(
            domainHash,
            config.pricerContract,
            config.paymentType,
            config.accessType
        );
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `pricerContract` field of the struct.
     * Made to be able to set the pricer contract for a domain without setting the whole config.
     * Only domain owner/operator can call this function.
     * Fires `PricerContractSet` event.
     * @param domainHash The domain hash to set the pricer contract for
     * @param pricerContract The new pricer contract to set
    */
    function setPricerContractForDomain(
        bytes32 domainHash,
        IZNSPricer pricerContract
    ) public override {
        if (!registry.isOwnerOrOperator(domainHash, msg.sender))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        if (address(pricerContract) == address(0))
            revert ZeroAddressPassed();

        distrConfigs[domainHash].pricerContract = pricerContract;

        emit PricerContractSet(domainHash, address(pricerContract));
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `paymentType` field of the struct.
     * Made to be able to set the payment type for a domain without setting the whole config.
     * Only domain owner/operator can call this function.
     * Fires `PaymentTypeSet` event.
     * @param domainHash The domain hash to set the payment type for
     * @param paymentType The new payment type to set
    */
    function setPaymentTypeForDomain(
        bytes32 domainHash,
        PaymentType paymentType
    ) public override {
        if (!registry.isOwnerOrOperator(domainHash, msg.sender))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        distrConfigs[domainHash].paymentType = paymentType;

        emit PaymentTypeSet(domainHash, paymentType);
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `accessType` field of the struct.
     * Made to be able to set the access type for a domain without setting the whole config.
     * Only domain owner/operator or ZNSRootRegistrar can call this function.
     * Fires `AccessTypeSet` event.
     * @param domainHash The domain hash to set the access type for
     * @param accessType The new access type to set
    */
    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        distrConfigs[domainHash].accessType = accessType;
        emit AccessTypeSet(domainHash, accessType);
    }

    /**
     * @notice Setter for `mintlist[domainHash][candidate]`. Only domain owner/operator can call this function.
     * Adds or removes candidates from the mintlist for a domain. Should only be used when the domain's owner
     * wants to limit subdomain registration to a specific set of addresses.
     * Can be used to add/remove multiple candidates at once. Can only be called by the domain owner/operator.
     * Fires `MintlistUpdated` event.
     * @param domainHash The domain hash to set the mintlist for
     * @param candidates The array of candidates to add/remove
     * @param allowed The array of booleans indicating whether to add or remove the candidate
    */
    function updateMintlistForDomain(
        bytes32 domainHash,
        address[] calldata candidates,
        bool[] calldata allowed
    ) external override {
        if (!registry.isOwnerOrOperator(domainHash, msg.sender))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        Mintlist storage mintlistForDomain = mintlist[domainHash];
        uint256 ownerIndex = mintlistForDomain.ownerIndex;

        for (uint256 i; i < candidates.length; i++) {
            mintlistForDomain.list[ownerIndex][candidates[i]] = allowed[i];
        }

        emit MintlistUpdated(domainHash, ownerIndex, candidates, allowed);
    }

    function isMintlistedForDomain(
        bytes32 domainHash,
        address candidate
    ) external view override returns (bool) {
        uint256 ownerIndex = mintlist[domainHash].ownerIndex;
        return mintlist[domainHash].list[ownerIndex][candidate];
    }

    /*
     * @notice Function to completely clear/remove the whole mintlist set for a given domain.
     * Can only be called by the owner/operator of the domain or by `ZNSRootRegistrar` as a part of the
     * `revokeDomain()` flow.
     * Emits `MintlistCleared` event.
     * @param domainHash The domain hash to clear the mintlist for
     */
    function clearMintlistForDomain(bytes32 domainHash)
    public
    override
    onlyOwnerOperatorOrRegistrar(domainHash) {
        mintlist[domainHash].ownerIndex = mintlist[domainHash].ownerIndex + 1;

        emit MintlistCleared(domainHash);
    }

    function clearMintlistAndLock(bytes32 domainHash)
    external
    override
    onlyOwnerOperatorOrRegistrar(domainHash) {
        setAccessTypeForDomain(domainHash, AccessType.LOCKED);
        clearMintlistForDomain(domainHash);
    }

    /**
     * @notice Sets the registry address in state.
     * @dev This function is required for all contracts inheriting `ARegistryWired`.
    */
    function setRegistry(address registry_) public override(ARegistryWired, IZNSSubRegistrar) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Setter for `rootRegistrar`. Only admin can call this function.
     * Fires `RootRegistrarSet` event.
     * @param registrar_ The new address of the ZNSRootRegistrar contract
    */
    function setRootRegistrar(address registrar_) public override onlyAdmin {
        if (registrar_ == address(0)) revert ZeroAddressPassed();
        rootRegistrar = IZNSRootRegistrar(registrar_);

        emit RootRegistrarSet(registrar_);
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
